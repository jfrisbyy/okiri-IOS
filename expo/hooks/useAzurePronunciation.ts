import { useState, useRef, useCallback } from 'react';
import { Platform } from 'react-native';
import { Audio } from 'expo-av';
import {
  assessPronunciation,
  assessPronunciationFromUri,
  assessPronunciationFromUriViaServer,
  assessPronunciationViaServer,
  convertBlobToWav,
} from '@/utils/azurePronunciation';
import type { PronunciationResult } from '@/utils/azurePronunciation';

export type { PronunciationResult, PhonemeScore, WordScore } from '@/utils/azurePronunciation';

type NativeAudioFormat = 'wav' | 'ogg' | 'aac';

interface UseAzurePronunciationReturn {
  isRecording: boolean;
  isAnalyzing: boolean;
  result: PronunciationResult | null;
  error: string | null;
  lastAudioBase64: string | null;
  startRecording: () => Promise<void>;
  stopAndAssess: (referenceText: string) => Promise<PronunciationResult | null>;
  reset: () => void;
}

export function useAzurePronunciation(locale: string = 'fr-FR'): UseAzurePronunciationReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<PronunciationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastAudioBase64, setLastAudioBase64] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const nativeRecordingRef = useRef<Audio.Recording | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const nativeFormatRef = useRef<NativeAudioFormat>('wav');
  const localeRef = useRef(locale);
  localeRef.current = locale;

  const startRecording = useCallback(async () => {
    setError(null);
    setResult(null);

    try {
      if (Platform.OS === 'web') {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          setError('Microphone not available in this browser. Please open the app directly (not in an iframe/preview) or use a mobile device.');
          console.warn('[AzurePron] navigator.mediaDevices.getUserMedia not available');
          return;
        }

        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              sampleRate: 16000,
              channelCount: 1,
              echoCancellation: true,
              noiseSuppression: true,
            },
          });
        } catch (permErr: any) {
          console.warn('[AzurePron] getUserMedia error:', permErr.name, permErr.message);
          if (permErr.name === 'NotAllowedError' || permErr.name === 'PermissionDeniedError') {
            setError('Microphone access denied. Please allow microphone permission in your browser settings and reload, or scan the QR code to use the app on your phone.');
          } else if (permErr.name === 'NotFoundError') {
            setError('No microphone found. Please connect a microphone and try again.');
          } else if (permErr.name === 'NotReadableError') {
            setError('Microphone is in use by another app. Please close other apps using the mic and try again.');
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
        console.log('[AzurePron] Web recording started, format:', mimeType);
      } else {
        const perm = await Audio.requestPermissionsAsync();
        console.log('[AzurePron] Native permission status:', perm.status, 'canAskAgain:', perm.canAskAgain);
        if (perm.status !== 'granted') {
          if (!perm.canAskAgain) {
            setError('Microphone permission was denied. Please enable it in your device Settings > Privacy > Microphone.');
          } else {
            setError('Microphone permission is required to practice pronunciation.');
          }
          return;
        }

        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });

        let recording: Audio.Recording;

        if (Platform.OS === 'ios') {
          const result = await Audio.Recording.createAsync({
            android: { extension: '.wav', outputFormat: 0, audioEncoder: 0, sampleRate: 16000, numberOfChannels: 1 },
            ios: {
              extension: '.wav',
              outputFormat: 'lpcm' as any,
              audioQuality: 127,
              sampleRate: 16000,
              numberOfChannels: 1,
              bitRate: 256000,
              linearPCMBitDepth: 16,
              linearPCMIsBigEndian: false,
              linearPCMIsFloat: false,
            },
            web: {},
          });
          recording = result.recording;
          nativeFormatRef.current = 'wav';
        } else {
          const iosConfig = { extension: '.wav', outputFormat: 'lpcm' as any, audioQuality: 127, sampleRate: 16000, numberOfChannels: 1, bitRate: 256000, linearPCMBitDepth: 16, linearPCMIsBigEndian: false, linearPCMIsFloat: false };
          let androidRecording: Audio.Recording | null = null;

          try {
            const res = await Audio.Recording.createAsync({
              android: { extension: '.ogg', outputFormat: 11, audioEncoder: 7, sampleRate: 16000, numberOfChannels: 1, bitRate: 64000 },
              ios: iosConfig,
              web: {},
            });
            androidRecording = res.recording;
            nativeFormatRef.current = 'ogg';
            console.log('[AzurePron] Android: recording OGG Opus');
          } catch (oggErr) {
            console.log('[AzurePron] OGG Opus unavailable:', (oggErr as Error)?.message);
          }

          if (!androidRecording) {
            try {
              const res = await Audio.Recording.createAsync({
                android: { extension: '.webm', outputFormat: 9, audioEncoder: 7, sampleRate: 16000, numberOfChannels: 1, bitRate: 64000 },
                ios: iosConfig,
                web: {},
              });
              androidRecording = res.recording;
              nativeFormatRef.current = 'ogg';
              console.log('[AzurePron] Android: recording WebM Opus');
            } catch (webmErr) {
              console.log('[AzurePron] WebM Opus unavailable:', (webmErr as Error)?.message);
            }
          }

          if (!androidRecording) {
            console.log('[AzurePron] Falling back to M4A AAC (limited Azure support)');
            const res = await Audio.Recording.createAsync({
              android: { extension: '.m4a', outputFormat: 2, audioEncoder: 3, sampleRate: 16000, numberOfChannels: 1, bitRate: 128000 },
              ios: iosConfig,
              web: {},
            });
            androidRecording = res.recording;
            nativeFormatRef.current = 'aac';
            console.log('[AzurePron] Android: recording M4A AAC (last resort)');
          }

          recording = androidRecording;
        }

        nativeRecordingRef.current = recording;
        setIsRecording(true);
        console.log('[AzurePron] Native recording started, platform:', Platform.OS, 'format:', nativeFormatRef.current);
      }
    } catch (err: any) {
      console.error('[AzurePron] Recording start error:', err?.name, err?.message);
      const errMsg = err?.message || 'Failed to start recording';
      if (errMsg.includes('permission') || errMsg.includes('Permission')) {
        setError('Microphone permission is required. Please enable it in your device settings.');
      } else if (errMsg.includes('busy') || errMsg.includes('in use')) {
        setError('Microphone is in use by another app. Please close other apps and try again.');
      } else {
        setError(errMsg);
      }
    }
  }, []);

  const stopAndAssess = useCallback(
    async (referenceText: string): Promise<PronunciationResult | null> => {
      setIsRecording(false);
      setIsAnalyzing(true);
      setError(null);

      try {
        if (!referenceText || referenceText.trim().length === 0) {
          throw new Error('No reference text to assess against.');
        }

        if (Platform.OS === 'web') {
          let rawBlob: Blob;
          try {
            rawBlob = await new Promise<Blob>((resolve, reject) => {
              const recorder = mediaRecorderRef.current;
              if (!recorder || recorder.state === 'inactive') {
                reject(new Error('No active recording. Please try again.'));
                return;
              }

              const timeoutId = setTimeout(() => {
                reject(new Error('Recording stop timed out. Please try again.'));
              }, 5000);

              recorder.onstop = () => {
                clearTimeout(timeoutId);
                const chunks = audioChunksRef.current;
                console.log('[AzurePron] Collected', chunks.length, 'audio chunks');
                const blob = new Blob(chunks, { type: recorder.mimeType });
                console.log('[AzurePron] Raw blob size:', blob.size, 'type:', blob.type);
                streamRef.current?.getTracks().forEach((t) => t.stop());
                streamRef.current = null;
                mediaRecorderRef.current = null;
                audioChunksRef.current = [];
                resolve(blob);
              };

              recorder.stop();
            });
          } catch (stopErr: any) {
            streamRef.current?.getTracks().forEach((t) => t.stop());
            streamRef.current = null;
            mediaRecorderRef.current = null;
            audioChunksRef.current = [];
            throw stopErr;
          }

          if (rawBlob.size < 100) {
            throw new Error('Recording too short or empty. Please speak clearly and try again.');
          }

          console.log('[AzurePron] Converting WebM to WAV for assessment...');
          const audioBlob = await convertBlobToWav(rawBlob, 16000);
          console.log('[AzurePron] WAV blob size:', audioBlob.size, 'bytes');

          try {
            const audioBase64 = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => {
                const dataUrl = reader.result as string;
                const b64 = dataUrl.split(',')[1] || '';
                resolve(b64);
              };
              reader.onerror = reject;
              reader.readAsDataURL(audioBlob);
            });
            setLastAudioBase64(audioBase64);
            console.log('[AzurePron] Stored user audio base64, length:', audioBase64.length);
          } catch (b64Err) {
            console.warn('[AzurePron] Failed to convert audio to base64:', b64Err);
            setLastAudioBase64(null);
          }

          if (audioBlob.size < 100) {
            throw new Error('Audio conversion produced empty result. Please try speaking louder.');
          }

          const currentLocale = localeRef.current;
          console.log('[AzurePron] Web assessing with locale:', currentLocale, 'reference:', referenceText);

          let assessmentResult: PronunciationResult | null = null;
          let serverError: string | null = null;
          let restError: string | null = null;

          try {
            console.log('[AzurePron] Trying server-side assessment (Speech SDK)...');
            assessmentResult = await assessPronunciationViaServer(
              audioBlob,
              referenceText,
              currentLocale,
            );
            console.log('[AzurePron] Server assessment succeeded!');
          } catch (serverErr: any) {
            serverError = serverErr?.message || String(serverErr);
            console.log('[AzurePron] Server assessment failed:', serverError);
            try {
              console.log('[AzurePron] Falling back to direct Azure REST API...');
              assessmentResult = await assessPronunciation(
                audioBlob,
                referenceText,
                currentLocale,
              );
              console.log('[AzurePron] Direct REST API assessment succeeded!');
            } catch (restErr: any) {
              restError = restErr?.message || String(restErr);
              console.error('[AzurePron] REST API also failed:', restError);
              throw new Error(
                `Assessment failed. Server: ${serverError} | REST API: ${restError}`
              );
            }
          }

          setResult(assessmentResult);
          return assessmentResult;
        } else {
          const recording = nativeRecordingRef.current;
          if (!recording) throw new Error('No active recording. Please try again.');

          await recording.stopAndUnloadAsync();
          await Audio.setAudioModeAsync({ allowsRecordingIOS: false });

          const uri = recording.getURI();
          nativeRecordingRef.current = null;

          if (!uri) throw new Error('Failed to get recording file. Please try again.');

          try {
            const { readAsStringAsync, EncodingType } = await import('expo-file-system/legacy');
            const nativeBase64 = await readAsStringAsync(uri, { encoding: EncodingType.Base64 });
            setLastAudioBase64(nativeBase64);
            console.log('[AzurePron] Stored native audio base64, length:', nativeBase64.length);
          } catch (b64Err) {
            console.warn('[AzurePron] Failed to read native audio as base64:', b64Err);
            setLastAudioBase64(null);
          }

          const format = nativeFormatRef.current;
          let nativeContentType: string;
          if (Platform.OS === 'ios' || format === 'wav') {
            nativeContentType = 'audio/wav; codecs=audio/pcm; samplerate=16000';
          } else if (format === 'ogg') {
            nativeContentType = 'audio/ogg; codecs=opus';
          } else {
            nativeContentType = 'audio/mp4';
          }

          const currentLocale = localeRef.current;
          const nativeMimeType = format === 'wav' ? 'audio/wav' : format === 'ogg' ? 'audio/ogg' : 'audio/mp4';
          console.log('[AzurePron] Native upload, format:', format, 'content-type:', nativeContentType, 'locale:', currentLocale);
          console.log('[AzurePron] Reference text:', referenceText);
          console.log('[AzurePron] File URI:', uri);

          let assessmentResult: PronunciationResult | null = null;

          try {
            console.log('[AzurePron] Trying server-side assessment for native...');
            assessmentResult = await assessPronunciationFromUriViaServer(
              uri,
              referenceText,
              currentLocale,
              nativeMimeType,
            );
            console.log('[AzurePron] Server-side native assessment succeeded!');
          } catch (serverErr: any) {
            const serverErrMsg = serverErr?.message || String(serverErr);
            console.log('[AzurePron] Server-side native assessment failed:', serverErrMsg, '- falling back to direct Azure');
            try {
              assessmentResult = await assessPronunciationFromUri(
                uri,
                referenceText,
                currentLocale,
                nativeContentType,
              );
              console.log('[AzurePron] Direct Azure native assessment succeeded!');
            } catch (directErr: any) {
              console.error('[AzurePron] Direct Azure also failed:', directErr?.message);
              throw new Error(
                `Assessment failed. Server: ${serverErrMsg} | Direct: ${directErr?.message}`
              );
            }
          }

          setResult(assessmentResult);
          return assessmentResult;
        }
      } catch (err: any) {
        const rawMsg = err?.message || (typeof err === 'string' ? err : JSON.stringify(err));
        console.error('[AzurePron] Assessment error:', rawMsg);
        console.error('[AzurePron] Error name:', err?.name, 'stack:', err?.stack?.split('\n').slice(0, 3).join(' | '));

        let msg: string;
        if (rawMsg.includes('ASSESSMENT_DATA_MISSING')) {
          msg = Platform.OS === 'web'
            ? 'Pronunciation assessment is not available in this browser. Please scan the QR code and try on your phone for the best experience.'
            : 'Pronunciation scores were not returned. Please try speaking more clearly and ensure you are saying the displayed text.';
        } else if (rawMsg.includes('SERVER_UNAVAILABLE') || rawMsg.includes('NetworkError') || rawMsg.includes('Failed to fetch')) {
          msg = 'Could not connect to the assessment service. Please check your internet connection and try again.';
        } else if (rawMsg.includes('credentials') || rawMsg.includes('401') || rawMsg.includes('403')) {
          msg = 'Speech service credentials issue. Please contact support.';
        } else if (rawMsg.includes('too short') || rawMsg.includes('empty')) {
          msg = 'Recording was too short. Please speak for at least 1-2 seconds.';
        } else {
          msg = rawMsg || 'Failed to analyze pronunciation. Please try again.';
        }
        setError(msg);
        setResult(null);
        return null;
      } finally {
        setIsAnalyzing(false);
      }
    },
    [],
  );

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
    setLastAudioBase64(null);

    if (Platform.OS === 'web') {
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== 'inactive'
      ) {
        try {
          mediaRecorderRef.current.stop();
        } catch (e) {
          console.log('[AzurePron] Error stopping web recorder:', e);
        }
        streamRef.current?.getTracks().forEach((t) => t.stop());
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

    setIsRecording(false);
    setIsAnalyzing(false);
  }, []);

  return {
    isRecording,
    isAnalyzing,
    result,
    error,
    lastAudioBase64,
    startRecording,
    stopAndAssess,
    reset,
  };
}
