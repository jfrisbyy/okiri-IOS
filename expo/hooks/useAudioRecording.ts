import { useRef, useCallback } from 'react';
import { Platform } from 'react-native';
import { Audio } from 'expo-av';

interface UseAudioRecordingReturn {
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<string | undefined>;
  pauseRecording: () => Promise<void>;
  resumeRecording: () => Promise<void>;
  isRecordingActive: () => boolean;
  cleanup: () => void;
}

export function useAudioRecording(): UseAudioRecordingReturn {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const nativeRecordingRef = useRef<Audio.Recording | null>(null);
  const isPausedRef = useRef<boolean>(false);

  const isWeb = Platform.OS === 'web';

  const startRecording = useCallback(async () => {
    if (isWeb) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
        });
        
        audioChunksRef.current = [];
        
        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };
        
        mediaRecorder.start(1000);
        mediaRecorderRef.current = mediaRecorder;
      } catch (error) {
        console.log('Web recording error:', error);
      }
    } else {
      try {
        const permission = await Audio.requestPermissionsAsync();
        if (permission.status !== 'granted') {
          console.log('Audio permission not granted');
          return;
        }

        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });

        const { recording } = await Audio.Recording.createAsync(
          Audio.RecordingOptionsPresets.HIGH_QUALITY
        );
        
        nativeRecordingRef.current = recording;
        isPausedRef.current = false;
      } catch (error) {
        console.log('Native recording error:', error);
      }
    }
  }, [isWeb]);

  const stopRecording = useCallback(async (): Promise<string | undefined> => {
    if (isWeb) {
      return new Promise((resolve) => {
        const mediaRecorder = mediaRecorderRef.current;
        if (!mediaRecorder || mediaRecorder.state === 'inactive') {
          resolve(undefined);
          return;
        }

        mediaRecorder.onstop = () => {
          const audioBlob = new Blob(audioChunksRef.current, { 
            type: mediaRecorder.mimeType || 'audio/webm' 
          });
          
          mediaRecorder.stream.getTracks().forEach(track => track.stop());
          
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64 = reader.result as string;
            mediaRecorderRef.current = null;
            audioChunksRef.current = [];
            resolve(base64);
          };
          reader.onerror = () => {
            resolve(undefined);
          };
          reader.readAsDataURL(audioBlob);
        };

        mediaRecorder.stop();
      });
    } else {
      try {
        const recording = nativeRecordingRef.current;
        if (!recording) {
          return undefined;
        }

        await recording.stopAndUnloadAsync();
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
        });

        const uri = recording.getURI();
        nativeRecordingRef.current = null;
        isPausedRef.current = false;
        
        if (uri) {
          console.log('[AudioRecording] Native recording URI:', uri);
          return uri;
        }
        return undefined;
      } catch (error) {
        console.log('Stop native recording error:', error);
        return undefined;
      }
    }
  }, [isWeb]);

  const pauseRecording = useCallback(async () => {
    if (isWeb) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.pause();
        isPausedRef.current = true;
      }
    } else {
      try {
        if (nativeRecordingRef.current) {
          await nativeRecordingRef.current.pauseAsync();
          isPausedRef.current = true;
        }
      } catch (error) {
        console.log('Pause recording error:', error);
      }
    }
  }, [isWeb]);

  const resumeRecording = useCallback(async () => {
    if (isWeb) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
        mediaRecorderRef.current.resume();
        isPausedRef.current = false;
      }
    } else {
      try {
        if (nativeRecordingRef.current && isPausedRef.current) {
          await nativeRecordingRef.current.startAsync();
          isPausedRef.current = false;
        }
      } catch (error) {
        console.log('Resume recording error:', error);
      }
    }
  }, [isWeb]);

  const isRecordingActive = useCallback((): boolean => {
    if (isWeb) {
      return mediaRecorderRef.current !== null && 
             mediaRecorderRef.current.state !== 'inactive';
    } else {
      return nativeRecordingRef.current !== null;
    }
  }, [isWeb]);

  const cleanup = useCallback(() => {
    if (isWeb) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
        mediaRecorderRef.current.stop();
      }
      mediaRecorderRef.current = null;
      audioChunksRef.current = [];
    } else {
      if (nativeRecordingRef.current) {
        nativeRecordingRef.current.stopAndUnloadAsync().catch(() => {});
        nativeRecordingRef.current = null;
      }
    }
  }, [isWeb]);

  return {
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    isRecordingActive,
    cleanup,
  };
}
