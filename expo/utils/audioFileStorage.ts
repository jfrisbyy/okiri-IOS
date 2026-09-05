import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

const RECORDINGS_DIR = `${FileSystem.documentDirectory}recordings/`;

async function ensureRecordingsDir(): Promise<void> {
  if (Platform.OS === 'web') return;
  const dirInfo = await FileSystem.getInfoAsync(RECORDINGS_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(RECORDINGS_DIR, { intermediates: true });
    console.log('[AudioFileStorage] Created recordings directory');
  }
}

export function isFilePath(value: string): boolean {
  return value.startsWith('file://') || value.startsWith(RECORDINGS_DIR);
}

export function isBase64DataUrl(value: string): boolean {
  return value.startsWith('data:');
}

export function isSegmentJson(value: string): boolean {
  return value.startsWith('[');
}

export async function saveAudioToFile(audioData: string, logId: string): Promise<string> {
  if (Platform.OS === 'web') {
    return audioData;
  }

  try {
    await ensureRecordingsDir();

    if (isSegmentJson(audioData)) {
      const segments: string[] = JSON.parse(audioData);
      const savedPaths: string[] = [];

      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        const segPath = `${RECORDINGS_DIR}${logId}_seg${i}.wav`;

        if (isBase64DataUrl(segment)) {
          const base64Only = segment.split(',')[1];
          if (base64Only) {
            await FileSystem.writeAsStringAsync(segPath, base64Only, {
              encoding: FileSystem.EncodingType.Base64,
            });
            savedPaths.push(segPath);
            console.log(`[AudioFileStorage] Saved segment ${i} -> ${segPath}`);
          }
        } else if (segment.startsWith('file://')) {
          const info = await FileSystem.getInfoAsync(segment);
          if (info.exists) {
            await FileSystem.copyAsync({ from: segment, to: segPath });
            savedPaths.push(segPath);
          }
        }
      }

      if (savedPaths.length > 0) {
        return JSON.stringify(savedPaths);
      }
      return audioData;
    }

    if (isBase64DataUrl(audioData)) {
      const mimeMatch = audioData.match(/^data:audio\/(\w+);base64,/);
      const ext = mimeMatch ? mimeMatch[1] : 'wav';
      const filePath = `${RECORDINGS_DIR}${logId}.${ext}`;
      const base64Only = audioData.split(',')[1];

      if (base64Only) {
        await FileSystem.writeAsStringAsync(filePath, base64Only, {
          encoding: FileSystem.EncodingType.Base64,
        });
        console.log(`[AudioFileStorage] Saved recording -> ${filePath}`);
        return filePath;
      }
    }

    if (audioData.startsWith('file://')) {
      const ext = audioData.split('.').pop() || 'wav';
      const filePath = `${RECORDINGS_DIR}${logId}.${ext}`;
      const info = await FileSystem.getInfoAsync(audioData);
      if (info.exists) {
        await FileSystem.copyAsync({ from: audioData, to: filePath });
        console.log(`[AudioFileStorage] Copied recording -> ${filePath}`);
        return filePath;
      }
    }

    return audioData;
  } catch (error) {
    console.error('[AudioFileStorage] Failed to save audio file:', error);
    return audioData;
  }
}

export async function deleteAudioFile(audioData: string): Promise<void> {
  if (Platform.OS === 'web') return;

  try {
    if (isSegmentJson(audioData)) {
      const paths: string[] = JSON.parse(audioData);
      for (const p of paths) {
        if (isFilePath(p)) {
          const info = await FileSystem.getInfoAsync(p);
          if (info.exists) {
            await FileSystem.deleteAsync(p, { idempotent: true });
            console.log(`[AudioFileStorage] Deleted segment: ${p}`);
          }
        }
      }
      return;
    }

    if (isFilePath(audioData)) {
      const info = await FileSystem.getInfoAsync(audioData);
      if (info.exists) {
        await FileSystem.deleteAsync(audioData, { idempotent: true });
        console.log(`[AudioFileStorage] Deleted recording: ${audioData}`);
      }
    }
  } catch (error) {
    console.error('[AudioFileStorage] Failed to delete audio file:', error);
  }
}

export async function migrateBase64ToFile(audioData: string, logId: string): Promise<string> {
  if (Platform.OS === 'web') return audioData;
  if (isFilePath(audioData)) return audioData;

  try {
    const filePath = await saveAudioToFile(audioData, logId);
    console.log(`[AudioFileStorage] Migrated log ${logId} from base64 to file`);
    return filePath;
  } catch (error) {
    console.error('[AudioFileStorage] Migration failed for log:', logId, error);
    return audioData;
  }
}
