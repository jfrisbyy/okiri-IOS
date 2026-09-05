import { Audio } from 'expo-av';
import { Platform } from 'react-native';

const getBackendUrl = () => {
  const url = process.env.EXPO_PUBLIC_RORK_API_BASE_URL;
  if (!url) {
    console.error('[Dubbing] EXPO_PUBLIC_RORK_API_BASE_URL not set');
    return '';
  }
  return `${url}/api`;
};

export interface DubClip {
  segmentIndex: number;
  startTime: number;
  endTime: number;
  audioBase64: string;
}

interface TranscriptSegmentInput {
  text: string;
  start: number;
  duration: number;
}

async function fetchDubSegment(
  videoId: string,
  segmentIndex: number,
  frenchText: string,
  voiceId?: string,
  speed?: number,
): Promise<string | null> {
  const backendUrl = getBackendUrl();
  if (!backendUrl) return null;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);

    const body: Record<string, unknown> = {
      videoId,
      segmentIndex,
      frenchText,
    };
    if (voiceId) body.voiceId = voiceId;
    if (speed !== undefined) body.speed = speed;

    const res = await fetch(`${backendUrl}/dub-segment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.warn(`[Dubbing] Segment ${segmentIndex} failed (${res.status}): ${errText.substring(0, 120)}`);
      return null;
    }

    const data = await res.json();
    console.log(`[Dubbing] Segment ${segmentIndex} ready (cached: ${data.cached})`);
    return data.audio || null;
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      console.warn(`[Dubbing] Segment ${segmentIndex} timed out`);
    } else {
      console.warn(`[Dubbing] Segment ${segmentIndex} error: ${err?.message}`);
    }
    return null;
  }
}

async function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number,
): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < tasks.length) {
      const idx = nextIndex++;
      results[idx] = await tasks[idx]();
    }
  }

  const workers: Promise<void>[] = [];
  for (let i = 0; i < Math.min(concurrency, tasks.length); i++) {
    workers.push(worker());
  }
  await Promise.all(workers);
  return results;
}

export async function generateDubForVideo(
  videoId: string,
  frenchTranscript: TranscriptSegmentInput[],
  onProgress?: (readyCount: number, totalCount: number) => void,
): Promise<DubClip[]> {
  const total = frenchTranscript.length;
  if (total === 0) {
    console.log('[Dubbing] Empty transcript, nothing to generate');
    return [];
  }

  console.log(`[Dubbing] Generating dubs for ${total} segments of video ${videoId}`);

  let completedCount = 0;
  const clips: (DubClip | null)[] = new Array(total).fill(null);

  const createTask = (seg: TranscriptSegmentInput, idx: number) => {
    return async (): Promise<DubClip | null> => {
      const audioBase64 = await fetchDubSegment(videoId, idx, seg.text);
      completedCount++;
      onProgress?.(completedCount, total);

      if (!audioBase64) return null;

      return {
        segmentIndex: idx,
        startTime: seg.start,
        endTime: seg.start + seg.duration,
        audioBase64,
      };
    };
  };

  const priorityCount = Math.min(15, total);
  const priorityTasks = frenchTranscript.slice(0, priorityCount).map((seg, idx) => createTask(seg, idx));

  console.log(`[Dubbing] Phase 1: generating priority batch (first ${priorityCount} segments)`);
  const priorityResults = await runWithConcurrency(priorityTasks, 5);
  for (let i = 0; i < priorityResults.length; i++) {
    clips[i] = priorityResults[i];
  }

  if (priorityCount < total) {
    const remainingTasks = frenchTranscript.slice(priorityCount).map((seg, idx) =>
      createTask(seg, priorityCount + idx),
    );

    console.log(`[Dubbing] Phase 2: generating remaining ${remainingTasks.length} segments`);
    const remainingResults = await runWithConcurrency(remainingTasks, 5);
    for (let i = 0; i < remainingResults.length; i++) {
      clips[priorityCount + i] = remainingResults[i];
    }
  }

  const validClips = clips.filter((c): c is DubClip => c !== null);
  console.log(`[Dubbing] Done: ${validClips.length}/${total} clips generated`);
  return validClips;
}

export class DubPlaybackEngine {
  private clips: DubClip[] = [];
  private mode: 'original' | 'french_dub' = 'original';
  private currentSound: Audio.Sound | null = null;
  private currentClipIndex: number = -1;
  private isPlaying: boolean = false;
  private disposed: boolean = false;

  constructor(clips: DubClip[]) {
    this.clips = [...clips].sort((a, b) => a.startTime - b.startTime);
    console.log(`[DubEngine] Initialized with ${this.clips.length} clips`);
  }

  setMode(mode: 'original' | 'french_dub'): void {
    console.log(`[DubEngine] Mode changed: ${this.mode} → ${mode}`);
    this.mode = mode;
    if (mode === 'original') {
      void this.stopCurrentClip();
    }
  }

  getMode(): 'original' | 'french_dub' {
    return this.mode;
  }

  updateClips(clips: DubClip[]): void {
    this.clips = [...clips].sort((a, b) => a.startTime - b.startTime);
    console.log(`[DubEngine] Updated to ${this.clips.length} clips`);
  }

  async syncToTimestamp(currentTimeSeconds: number): Promise<void> {
    if (this.disposed) return;
    if (this.mode !== 'french_dub') return;

    const matchIdx = this.findClipForTimestamp(currentTimeSeconds);

    if (matchIdx === -1) {
      if (this.isPlaying) {
        await this.stopCurrentClip();
      }
      return;
    }

    if (matchIdx === this.currentClipIndex && this.isPlaying) {
      return;
    }

    if (matchIdx !== this.currentClipIndex) {
      await this.stopCurrentClip();
      await this.playClip(matchIdx);
    }
  }

  private findClipForTimestamp(time: number): number {
    for (let i = 0; i < this.clips.length; i++) {
      const clip = this.clips[i];
      if (time >= clip.startTime && time < clip.endTime) {
        return i;
      }
    }
    return -1;
  }

  private async playClip(index: number): Promise<void> {
    if (this.disposed || index < 0 || index >= this.clips.length) return;

    const clip = this.clips[index];
    this.currentClipIndex = index;

    try {
      const uri =
        Platform.OS === 'web'
          ? `data:audio/mpeg;base64,${clip.audioBase64}`
          : `data:audio/mpeg;base64,${clip.audioBase64}`;

      const { sound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true, volume: 1.0 },
      );

      this.currentSound = sound;
      this.isPlaying = true;

      sound.setOnPlaybackStatusUpdate((status) => {
        if (!status.isLoaded) return;
        if (status.didJustFinish) {
          this.isPlaying = false;
          this.currentClipIndex = -1;
          sound.unloadAsync().catch(() => {});
          if (this.currentSound === sound) {
            this.currentSound = null;
          }
        }
      });

      console.log(`[DubEngine] Playing clip ${index} (${clip.startTime.toFixed(1)}s - ${clip.endTime.toFixed(1)}s)`);
    } catch (err: any) {
      console.warn(`[DubEngine] Failed to play clip ${index}: ${err?.message}`);
      this.isPlaying = false;
      this.currentClipIndex = -1;
    }
  }

  private async stopCurrentClip(): Promise<void> {
    if (this.currentSound) {
      try {
        await this.currentSound.stopAsync();
        await this.currentSound.unloadAsync();
      } catch {
      }
      this.currentSound = null;
    }
    this.isPlaying = false;
    this.currentClipIndex = -1;
  }

  async dispose(): Promise<void> {
    this.disposed = true;
    await this.stopCurrentClip();
    this.clips = [];
    console.log('[DubEngine] Disposed');
  }
}
