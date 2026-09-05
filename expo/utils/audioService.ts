import { Platform } from 'react-native';
import { Audio } from 'expo-av';

export type PlaybackSpeed = 0.5 | 0.75 | 1.0;

interface CacheEntry {
  blob: Blob;
  timestamp: number;
}

interface QueueItem {
  text: string;
  speed: PlaybackSpeed;
  resolve: () => void;
  reject: (err: Error) => void;
}

const ELEVENLABS_API_KEY = process.env.EXPO_PUBLIC_ELEVENLABS_API_KEY;
const ELEVENLABS_VOICE_ID = 'pFZP5JQG7iQjIQuC4Bku';
const ELEVENLABS_API_URL = `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`;

const CACHE_MAX_SIZE = 50;
const CACHE_TTL_MS = 10 * 60 * 1000;

class AudioService {
  private cache = new Map<string, CacheEntry>();
  private queue: QueueItem[] = [];
  private isProcessing = false;
  private currentSound: Audio.Sound | null = null;
  private currentWebAudio: HTMLAudioElement | null = null;
  private _isPlaying = false;
  private listeners = new Set<(playing: boolean) => void>();

  get isPlaying(): boolean {
    return this._isPlaying;
  }

  onPlayingChange(listener: (playing: boolean) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private setPlaying(value: boolean) {
    this._isPlaying = value;
    this.listeners.forEach(fn => fn(value));
  }

  private getCacheKey(text: string, speed: PlaybackSpeed): string {
    return `${text}__spd_${speed}`;
  }

  private getCached(text: string, speed: PlaybackSpeed): Blob | null {
    const key = this.getCacheKey(text, speed);
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
      this.cache.delete(key);
      return null;
    }
    return entry.blob;
  }

  private setCache(text: string, speed: PlaybackSpeed, blob: Blob) {
    const key = this.getCacheKey(text, speed);
    if (this.cache.size >= CACHE_MAX_SIZE) {
      const oldest = this.cache.keys().next().value;
      if (oldest) this.cache.delete(oldest);
    }
    this.cache.set(key, { blob, timestamp: Date.now() });
  }

  private async fetchTTSAudio(text: string, speed: PlaybackSpeed): Promise<Blob> {
    const cached = this.getCached(text, speed);
    if (cached) {
      console.log('[AudioService] Cache hit for:', text.substring(0, 30));
      return cached;
    }

    if (!ELEVENLABS_API_KEY) {
      throw new Error('ElevenLabs API key not configured');
    }

    const stabilityBySpeed: Record<PlaybackSpeed, number> = {
      0.5: 0.7,
      0.75: 0.6,
      1.0: 0.5,
    };

    console.log('[AudioService] Fetching TTS for:', text.substring(0, 40), 'speed:', speed);

    const response = await fetch(ELEVENLABS_API_URL, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': ELEVENLABS_API_KEY,
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: stabilityBySpeed[speed],
          similarity_boost: 0.8,
          style: 0.2,
          use_speaker_boost: true,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log('[AudioService] ElevenLabs error:', response.status, errorText);
      throw new Error(`ElevenLabs TTS error (${response.status})`);
    }

    const blob = await response.blob();
    console.log('[AudioService] Received audio blob:', blob.size, 'bytes');
    this.setCache(text, speed, blob);
    return blob;
  }

  private async playBlob(blob: Blob, speed: PlaybackSpeed): Promise<void> {
    if (Platform.OS === 'web') {
      return this.playBlobWeb(blob, speed);
    }
    return this.playBlobNative(blob, speed);
  }

  private playBlobWeb(blob: Blob, speed: PlaybackSpeed): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      try {
        const url = URL.createObjectURL(blob);
        const audio = new window.Audio(url);
        audio.playbackRate = speed;
        this.currentWebAudio = audio;

        audio.onended = () => {
          URL.revokeObjectURL(url);
          this.currentWebAudio = null;
          resolve();
        };

        audio.onerror = (_e) => {
          URL.revokeObjectURL(url);
          this.currentWebAudio = null;
          reject(new Error('Web audio playback error'));
        };

        audio.play().catch(reject);
      } catch (err) {
        reject(err);
      }
    });
  }

  private playBlobNative(blob: Blob, speed: PlaybackSpeed): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const reader = new FileReader();

      reader.onloadend = async () => {
        try {
          await Audio.setAudioModeAsync({
            playsInSilentModeIOS: true,
            staysActiveInBackground: false,
          });

          const base64Audio = reader.result as string;
          const { sound } = await Audio.Sound.createAsync(
            { uri: base64Audio },
            { shouldPlay: true, rate: speed, shouldCorrectPitch: true },
            (status) => {
              if (status.isLoaded && status.didJustFinish) {
                void sound.unloadAsync();
                this.currentSound = null;
                resolve();
              }
            },
          );
          this.currentSound = sound;
        } catch (err) {
          this.currentSound = null;
          reject(err);
        }
      };

      reader.onerror = () => {
        reject(new Error('Failed to read audio blob'));
      };

      reader.readAsDataURL(blob);
    });
  }

  async playFrenchAudio(text: string, speed: PlaybackSpeed = 1.0): Promise<void> {
    if (!text || text.trim().length === 0) {
      console.log('[AudioService] No text to speak');
      return;
    }

    return new Promise<void>((resolve, reject) => {
      this.queue.push({ text: text.trim(), speed, resolve, reject });
      void this.processQueue();
    });
  }

  async playFromUri(uri: string, speed: PlaybackSpeed = 1.0): Promise<void> {
    await this.stopCurrent();
    this.setPlaying(true);

    try {
      if (Platform.OS === 'web') {
        await new Promise<void>((resolve, reject) => {
          const audio = new window.Audio(uri);
          audio.playbackRate = speed;
          this.currentWebAudio = audio;

          audio.onended = () => {
            this.currentWebAudio = null;
            resolve();
          };
          audio.onerror = () => {
            this.currentWebAudio = null;
            reject(new Error('Web audio playback error'));
          };
          void audio.play().catch(reject);
        });
      } else {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
        });

        await new Promise<void>((resolve, reject) => {
          Audio.Sound.createAsync(
            { uri },
            { shouldPlay: true, rate: speed, shouldCorrectPitch: true },
          )
            .then(({ sound }) => {
              this.currentSound = sound;
              sound.setOnPlaybackStatusUpdate((status) => {
                if (status.isLoaded && status.didJustFinish) {
                  void sound.unloadAsync();
                  this.currentSound = null;
                  resolve();
                }
              });
            })
            .catch(reject);
        });
      }
    } finally {
      this.setPlaying(false);
    }
  }

  private async processQueue() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    while (this.queue.length > 0) {
      const item = this.queue.shift()!;
      this.setPlaying(true);

      try {
        const blob = await this.fetchTTSAudio(item.text, item.speed);
        await this.playBlob(blob, item.speed);
        item.resolve();
      } catch (err) {
        console.log('[AudioService] Playback error:', err);
        item.reject(err instanceof Error ? err : new Error(String(err)));
      }
    }

    this.setPlaying(false);
    this.isProcessing = false;
  }

  async stopCurrent(): Promise<void> {
    this.queue.length = 0;

    if (Platform.OS === 'web') {
      if (this.currentWebAudio) {
        this.currentWebAudio.pause();
        this.currentWebAudio.currentTime = 0;
        this.currentWebAudio = null;
      }
    } else {
      if (this.currentSound) {
        try {
          await this.currentSound.stopAsync();
          await this.currentSound.unloadAsync();
        } catch (e) {
          console.log('[AudioService] Stop error:', e);
        }
        this.currentSound = null;
      }
    }

    this.setPlaying(false);
    this.isProcessing = false;
  }

  clearCache() {
    this.cache.clear();
    console.log('[AudioService] Cache cleared');
  }

  getCacheSize(): number {
    return this.cache.size;
  }
}

export const audioService = new AudioService();
