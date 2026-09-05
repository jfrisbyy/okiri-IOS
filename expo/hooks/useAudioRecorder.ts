import { useState, useRef, useCallback } from 'react';
import { Platform } from 'react-native';
import { Audio } from 'expo-av';
import { readAsStringAsync, EncodingType } from 'expo-file-system/legacy';
import { convertBlobToWav } from '@/utils/azurePronunciation';

export interface AudioRecordingResult {
  base64: string;
  mimeType: string;
}

interface UseAudioRecorderReturn {
  isRecording: boolean;
  isStopping: boolean;
  error: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<AudioRecordingResult | null>;
  reset: () => void;
}

export function useAudioRecorder(): UseAudioRecorderReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const nativeRecordingRef = useRef<Audio.Recording | null>(null);
  const nativeFormatRef = useRef<'wav' | 'ogg' | 'aac'>('wav');

  const startRecording = useCallback(async () => {
    setError(null);

    try {
      if (Platform.OS === 'web') {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          setError('Microphone not available in this browser. Please open the app directly or use a mobile device.');
          return;
        }

        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true, noiseSuppression: true },
          });
        } catch (permErr: any) {
          if (permErr.name === 'NotAllowedError' || permErr.name === 'PermissionDeniedError') {
            setError('Microphone access denied. Please allow microphone permission in your browser settings.');
          } else if (permErr.name === 'NotFoundError') {
            setError('No microphone found. Please connect a microphone and try again.');
          } else {
            setError(permErr.message || 'Could not access microphone.');
          }
          return;
        }

        streamRef.current = stream;
        audioChunksRef.current = [];

        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm';

        const recorder = new MediaRecorder(stream, { mimeType });
        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) audioChunksRef.current.push(e.data);
        };

        recorder.start(100);
        setIsRecording(true);
        console.log('[AudioRecorder] Web recording started, format:', mimeType);
      } else {
        const perm = await Audio.requestPermissionsAsync();
        console.log('[AudioRecorder] Permission status:', perm.status);
        if (perm.status !== 'granted') {
          if (!perm.canAskAgain) {
            setError('Microphone permission was denied. Please enable it in your device Settings > Privacy > Microphone.');
          } else {
            setError('Microphone permission is required to practice pronunciation.');
          }
          return;
        }

        await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });

        let recording: Audio.Recording;
        const iosConfig = {
          extension: '.wav',
          outputFormat: 'lpcm' as any,
          audioQuality: 127,
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 256000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        };

        if (Platform.OS === 'ios') {
          const res = await Audio.Recording.createAsync({
            android: { extension: '.wav', outputFormat: 0, audioEncoder: 0, sampleRate: 16000, numberOfChannels: 1 },
            ios: iosConfig,
            web: {},
          });
          recording = res.recording;
          nativeFormatRef.current = 'wav';
        } else {
          let androidRecording: Audio.Recording | null = null;

          try {
            const res = await Audio.Recording.createAsync({
              android: { extension: '.ogg', outputFormat: 11, audioEncoder: 7, sampleRate: 16000, numberOfChannels: 1, bitRate: 64000 },
              ios: iosConfig,
              web: {},
            });
            androidRecording = res.recording;
            nativeFormatRef.current = 'ogg';
            console.log('[AudioRecorder] Android: recording OGG Opus');
          } catch (oggErr) {
            console.log('[AudioRecorder] OGG unavailable:', (oggErr as Error)?.message);
          }

          if (!androidRecording) {
            try {
              const res = await Audio.Recording.createAsync({
                android: { extension: '.m4a', outputFormat: 2, audioEncoder: 3, sampleRate: 16000, numberOfChannels: 1, bitRate: 128000 },
                ios: iosConfig,
                web: {},
              });
              androidRecording = res.recording;
              nativeFormatRef.current = 'aac';
              console.log('[AudioRecorder] Android: recording M4A AAC');
            } catch (m4aErr) {
              console.log('[AudioRecorder] M4A unavailable:', (m4aErr as Error)?.message);
            }
          }

          if (!androidRecording) throw new Error('Could not start recording on this device.');
          recording = androidRecording;
        }

        nativeRecordingRef.current = recording;
        setIsRecording(true);
        console.log('[AudioRecorder] Native recording started, platform:', Platform.OS, 'format:', nativeFormatRef.current);
      }
    } catch (err: any) {
      console.error('[AudioRecorder] Start error:', err?.message);
      setError(err?.message || 'Failed to start recording');
    }
  }, []);

  const stopRecording = useCallback(async (): Promise<AudioRecordingResult | null> => {
    setIsRecording(false);
    setIsStopping(true);
    setError(null);

    try {
      if (Platform.OS === 'web') {
        const rawBlob = await new Promise<Blob>((resolve, reject) => {
          const recorder = mediaRecorderRef.current;
          if (!recorder || recorder.state === 'inactive') {
            reject(new Error('No active recording. Please try again.'));
            return;
          }

          const timeoutId = setTimeout(() => reject(new Error('Recording stop timed out.')), 5000);

          recorder.onstop = () => {
            clearTimeout(timeoutId);
            const chunks = audioChunksRef.current;
            console.log('[AudioRecorder] Collected', chunks.length, 'audio chunks');
            const blob = new Blob(chunks, { type: recorder.mimeType });
            console.log('[AudioRecorder] Raw blob size:', blob.size, 'type:', blob.type);
            streamRef.current?.getTracks().forEach(t => t.stop());
            streamRef.current = null;
            mediaRecorderRef.current = null;
            audioChunksRef.current = [];
            resolve(blob);
          };

          recorder.stop();
        });

        if (rawBlob.size < 100) {
          throw new Error('Recording too short or empty. Please speak clearly and try again.');
        }

        console.log('[AudioRecorder] Converting WebM to WAV...');
        const wavBlob = await convertBlobToWav(rawBlob, 16000);
        console.log('[AudioRecorder] WAV blob size:', wavBlob.size);

        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const dataUrl = reader.result as string;
            resolve(dataUrl.split(',')[1] || '');
          };
          reader.onerror = reject;
          reader.readAsDataURL(wavBlob);
        });

        console.log('[AudioRecorder] Audio base64 ready, length:', base64.length);
        return { base64, mimeType: 'audio/wav' };
      } else {
        const recording = nativeRecordingRef.current;
        if (!recording) throw new Error('No active recording. Please try again.');

        await recording.stopAndUnloadAsync();
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false });

        const uri = recording.getURI();
        nativeRecordingRef.current = null;

        if (!uri) throw new Error('Failed to get recording file.');

        const base64 = await readAsStringAsync(uri, { encoding: EncodingType.Base64 });

        const format = nativeFormatRef.current;
        const mimeType = format === 'wav' ? 'audio/wav' : format === 'ogg' ? 'audio/ogg' : 'audio/mp4';

        console.log('[AudioRecorder] Native audio base64 ready, format:', format, 'length:', base64.length);
        return { base64, mimeType };
      }
    } catch (err: any) {
      console.error('[AudioRecorder] Stop error:', err?.message);
      setError(err?.message || 'Failed to stop recording');
      return null;
    } finally {
      setIsStopping(false);
    }
  }, []);

  const reset = useCallback(() => {
    setError(null);
    setIsRecording(false);
    setIsStopping(false);

    if (Platform.OS === 'web') {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try { mediaRecorderRef.current.stop(); } catch {}
        streamRef.current?.getTracks().forEach(t => t.stop());
      }
      mediaRecorderRef.current = null;
      streamRef.current = null;
      audioChunksRef.current = [];
    } else {
      if (nativeRecordingRef.current) {
        nativeRecordingRef.current.stopAndUnloadAsync().catch(() => {});
        nativeRecordingRef.current = null;
      }
    }
  }, []);

  return { isRecording, isStopping, error, startRecording, stopRecording, reset };
}
