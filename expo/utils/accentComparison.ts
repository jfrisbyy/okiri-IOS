import { Platform } from 'react-native';
import { synthesizeRegionalSpeech } from '@/utils/azureRegionalTTS';
import {
  assessPronunciation,
  assessPronunciationViaServer,
  convertBlobToWav,
} from '@/utils/azurePronunciation';
import type { PronunciationResult, WordScore, PhonemeScore } from '@/utils/azurePronunciation';
import type { FrenchRegionId } from '@/data/regionalAccents';
import { getVoicesForRegion } from '@/data/regionalAccents';

export interface DualAudioComparison {
  referencePhonemes: PhonemeScore[];
  userPhonemes: PhonemeScore[];
  referenceWords: WordScore[];
  userWords: WordScore[];
  referenceRecognizedText: string;
  userRecognizedText: string;
  phonemeSimilarityScore: number;
}

function synthesizeAsWav(regionId: FrenchRegionId, text: string): Promise<Blob> {
  return synthesizeRegionalSpeechWav({ regionId, text, voiceGender: 'female', rate: '-10%' });
}

async function synthesizeRegionalSpeechWav(options: {
  regionId: FrenchRegionId;
  text: string;
  voiceGender?: 'female' | 'male';
  rate?: string;
  pitch?: string;
}): Promise<Blob> {
  const { regionId, text, voiceGender = 'female', rate = '0%', pitch = '0%' } = options;

  const apiKey = (process.env.EXPO_PUBLIC_AZURE_SPEECH_KEY || '').trim();
  const region = (process.env.EXPO_PUBLIC_AZURE_SPEECH_REGION || '').trim();

  if (!apiKey || !region) {
    throw new Error('Azure Speech credentials not configured.');
  }

  const voices = getVoicesForRegion(regionId);
  const voice = voices.find(v => v.gender === voiceGender) || voices[0];

  if (!voice) {
    throw new Error(`No voice found for region ${regionId}`);
  }

  const escapeXml = (str: string) =>
    str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

  const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='${regionId}'>
    <voice name='${voice.azureVoiceId}'>
      <prosody rate='${rate}' pitch='${pitch}'>
        ${escapeXml(text)}
      </prosody>
    </voice>
  </speak>`;

  const endpoint = `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;

  console.log('[AccentCompare] Synthesizing WAV reference for:', regionId, 'voice:', voice.azureVoiceId);

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': apiKey,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': 'riff-16khz-16bit-mono-pcm',
    },
    body: ssml,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[AccentCompare] TTS error:', response.status, errorText);
    throw new Error(`TTS error (${response.status}): ${errorText}`);
  }

  const audioBlob = await response.blob();
  console.log('[AccentCompare] Reference WAV received:', audioBlob.size, 'bytes');
  return audioBlob;
}

async function assessReferenceBlob(
  audioBlob: Blob,
  referenceText: string,
  language: string,
): Promise<PronunciationResult> {
  let result: PronunciationResult | null = null;

  try {
    console.log('[AccentCompare] Trying server assessment for reference audio...');
    result = await assessPronunciationViaServer(audioBlob, referenceText, language);
    console.log('[AccentCompare] Server assessment succeeded for reference');
  } catch (serverErr: any) {
    console.log('[AccentCompare] Server failed:', serverErr?.message, '- trying direct REST');
    try {
      result = await assessPronunciation(audioBlob, referenceText, language, 'audio/wav; codecs=audio/pcm; samplerate=16000');
      console.log('[AccentCompare] Direct REST succeeded for reference');
    } catch (restErr: any) {
      console.error('[AccentCompare] Both methods failed for reference:', restErr?.message);
      throw new Error(`Reference audio assessment failed: ${restErr?.message}`);
    }
  }

  return result;
}

export async function generateReferenceAssessment(
  regionId: FrenchRegionId,
  text: string,
  language: string,
): Promise<PronunciationResult> {
  console.log('[AccentCompare] Generating reference assessment for', regionId, ':', text);

  const wavBlob = await synthesizeAsWav(regionId, text);

  if (wavBlob.size < 200) {
    throw new Error('Reference audio too small. TTS may have failed.');
  }

  const result = await assessReferenceBlob(wavBlob, text, language);
  console.log('[AccentCompare] Reference assessment complete - recognized:', result.recognizedText);
  console.log('[AccentCompare] Reference phonemes count:', result.phonemes.length);

  return result;
}

function extractPhonemeSequence(words: WordScore[]): string[] {
  const phonemes: string[] = [];
  for (const w of words) {
    for (const p of w.phonemes) {
      if (p.nBestPhonemes && p.nBestPhonemes.length > 0) {
        phonemes.push(p.nBestPhonemes[0].phoneme);
      } else {
        phonemes.push(p.phoneme);
      }
    }
  }
  return phonemes;
}

function computePhonemeSimilarity(refWords: WordScore[], userWords: WordScore[]): number {
  const refSeq = extractPhonemeSequence(refWords);
  const userSeq = extractPhonemeSequence(userWords);

  if (refSeq.length === 0 || userSeq.length === 0) {
    console.log('[AccentCompare] Empty phoneme sequences - ref:', refSeq.length, 'user:', userSeq.length);
    return 0;
  }

  console.log('[AccentCompare] Reference phoneme sequence:', refSeq.join(' '));
  console.log('[AccentCompare] User phoneme sequence:', userSeq.join(' '));

  const maxLen = Math.max(refSeq.length, userSeq.length);
  const minLen = Math.min(refSeq.length, userSeq.length);

  let matches = 0;
  for (let i = 0; i < minLen; i++) {
    if (refSeq[i] === userSeq[i]) {
      matches++;
    }
  }

  const lengthPenalty = minLen / maxLen;
  const rawSimilarity = matches / minLen;
  const score = Math.round(rawSimilarity * lengthPenalty * 100);

  console.log('[AccentCompare] Phoneme similarity - matches:', matches, '/', minLen, 'lengthPenalty:', lengthPenalty.toFixed(2), 'score:', score);

  return score;
}

export function buildDualComparison(
  referenceResult: PronunciationResult,
  userResult: PronunciationResult,
): DualAudioComparison {
  const refPhonemes = referenceResult.words.flatMap(w => w.phonemes);
  const userPhonemes = userResult.words.flatMap(w => w.phonemes);

  const similarity = computePhonemeSimilarity(referenceResult.words, userResult.words);

  return {
    referencePhonemes: refPhonemes,
    userPhonemes: userPhonemes,
    referenceWords: referenceResult.words,
    userWords: userResult.words,
    referenceRecognizedText: referenceResult.recognizedText,
    userRecognizedText: userResult.recognizedText,
    phonemeSimilarityScore: similarity,
  };
}

export async function getReferenceAudioBase64(
  regionId: FrenchRegionId,
  text: string,
): Promise<string> {
  console.log('[AccentCompare] Getting reference audio as base64 for', regionId, ':', text);
  const wavBlob = await synthesizeAsWav(regionId, text);

  if (wavBlob.size < 200) {
    throw new Error('Reference audio too small. TTS may have failed.');
  }

  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      const b64 = dataUrl.split(',')[1] || '';
      resolve(b64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(wavBlob);
  });

  console.log('[AccentCompare] Reference audio base64 length:', base64.length);
  return base64;
}

export function formatComparisonForAI(comparison: DualAudioComparison): string {
  const lines: string[] = [];

  lines.push('=== DUAL AUDIO PHONEME COMPARISON ===');
  lines.push('');
  lines.push('REFERENCE (Native accent TTS audio — what Azure heard from the accent model):');
  lines.push(`Recognized: "${comparison.referenceRecognizedText}"`);

  for (const w of comparison.referenceWords) {
    const phonemeDetails = w.phonemes.map(p => {
      let detail = `/${p.phoneme}/ (${Math.round(p.accuracyScore)})`;
      if (p.nBestPhonemes && p.nBestPhonemes.length > 0) {
        const top = p.nBestPhonemes.slice(0, 3).map(nb => `/${nb.phoneme}/: ${Math.round(nb.score)}`).join(', ');
        detail += ` [heard: ${top}]`;
      }
      return detail;
    }).join('; ');
    lines.push(`  "${w.word}": ${phonemeDetails}`);
  }

  lines.push('');
  lines.push('USER RECORDING (What Azure heard from the learner):');
  lines.push(`Recognized: "${comparison.userRecognizedText}"`);

  for (const w of comparison.userWords) {
    const phonemeDetails = w.phonemes.map(p => {
      let detail = `/${p.phoneme}/ (${Math.round(p.accuracyScore)})`;
      if (p.nBestPhonemes && p.nBestPhonemes.length > 0) {
        const top = p.nBestPhonemes.slice(0, 3).map(nb => `/${nb.phoneme}/: ${Math.round(nb.score)}`).join(', ');
        detail += ` [heard: ${top}]`;
      }
      return detail;
    }).join('; ');
    lines.push(`  "${w.word}": ${phonemeDetails}`);
  }

  lines.push('');
  lines.push(`PHONEME SEQUENCE SIMILARITY SCORE: ${comparison.phonemeSimilarityScore}%`);
  lines.push('(This measures how many phonemes matched position-by-position between reference and user)');

  return lines.join('\n');
}
