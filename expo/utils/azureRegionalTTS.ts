import { Platform } from 'react-native';
import { Audio } from 'expo-av';
import type { FrenchRegionId } from '@/data/regionalAccents';
import { getVoicesForRegion } from '@/data/regionalAccents';

function getAzureCredentials() {
  const key = process.env.EXPO_PUBLIC_AZURE_SPEECH_KEY;
  const region = process.env.EXPO_PUBLIC_AZURE_SPEECH_REGION;
  if (!key || !region) {
    throw new Error('Azure Speech credentials not configured. Please set EXPO_PUBLIC_AZURE_SPEECH_KEY and EXPO_PUBLIC_AZURE_SPEECH_REGION.');
  }
  return { key, region };
}

export interface RegionalTTSOptions {
  regionId: FrenchRegionId;
  text: string;
  voiceGender?: 'female' | 'male';
  rate?: string;
  pitch?: string;
}

export async function synthesizeRegionalSpeech(options: RegionalTTSOptions): Promise<Blob> {
  const { regionId, text, voiceGender = 'female', rate = '0%', pitch = '0%' } = options;

  const { key, region } = getAzureCredentials();

  const voices = getVoicesForRegion(regionId);
  const voice = voices.find(v => v.gender === voiceGender) || voices[0];

  if (!voice) {
    throw new Error(`No voice found for region ${regionId}`);
  }

  const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='${regionId}'>
    <voice name='${voice.azureVoiceId}'>
      <prosody rate='${rate}' pitch='${pitch}'>
        ${escapeXml(text)}
      </prosody>
    </voice>
  </speak>`;

  const endpoint = `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;

  console.log('[AzureTTS] Synthesizing:', text, 'with voice:', voice.azureVoiceId);

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': key,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': 'audio-16khz-128kbitrate-mono-mp3',
    },
    body: ssml,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[AzureTTS] Error:', response.status, errorText);
    throw new Error(`Azure TTS error (${response.status}): ${errorText}`);
  }

  const audioBlob = await response.blob();
  console.log('[AzureTTS] Received audio:', audioBlob.size, 'bytes');
  return audioBlob;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

let currentWebAudio: HTMLAudioElement | null = null;
let currentSound: Audio.Sound | null = null;

export async function playRegionalAudio(
  options: RegionalTTSOptions,
  onStart?: () => void,
  onEnd?: () => void,
): Promise<void> {
  try {
    await stopRegionalAudio();
    onStart?.();

    const audioBlob = await synthesizeRegionalSpeech(options);

    if (Platform.OS === 'web') {
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new window.Audio(audioUrl);
      currentWebAudio = audio;

      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        currentWebAudio = null;
        onEnd?.();
      };

      audio.onerror = () => {
        URL.revokeObjectURL(audioUrl);
        currentWebAudio = null;
        onEnd?.();
      };

      await audio.play();
    } else {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
      });

      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);

      await new Promise<void>((resolve, reject) => {
        reader.onloadend = async () => {
          try {
            const base64Audio = reader.result as string;
            const { sound } = await Audio.Sound.createAsync(
              { uri: base64Audio },
              { shouldPlay: true },
              (status) => {
                if (status.isLoaded && status.didJustFinish) {
                  sound.unloadAsync();
                  currentSound = null;
                  onEnd?.();
                  resolve();
                }
              },
            );
            currentSound = sound;
          } catch (err) {
            console.error('[AzureTTS] Playback error:', err);
            onEnd?.();
            reject(err);
          }
        };

        reader.onerror = () => {
          onEnd?.();
          reject(new Error('Failed to read audio blob'));
        };
      });
    }
  } catch (err) {
    console.error('[AzureTTS] Play error:', err);
    onEnd?.();
    throw err;
  }
}

export async function stopRegionalAudio(): Promise<void> {
  if (Platform.OS === 'web') {
    if (currentWebAudio) {
      currentWebAudio.pause();
      currentWebAudio.currentTime = 0;
      currentWebAudio = null;
    }
  } else {
    if (currentSound) {
      try {
        await currentSound.stopAsync();
        await currentSound.unloadAsync();
      } catch (e) {
        console.log('[AzureTTS] Stop error:', e);
      }
      currentSound = null;
    }
  }
}
