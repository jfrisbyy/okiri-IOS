import { Platform } from 'react-native';
import { uploadAsync, getInfoAsync, readAsStringAsync, FileSystemUploadType, EncodingType } from 'expo-file-system/legacy';

const getServerUrl = (): string | null => {
  const baseUrl = (process.env.EXPO_PUBLIC_RORK_API_BASE_URL || '').trim();
  if (!baseUrl) return null;
  return `${baseUrl}/api/pronunciation-assessment`;
};

export interface AzurePhonemeResult {
  Phoneme: string;
  AccuracyScore?: number;
  NBestPhonemes?: Array<{
    Phoneme: string;
    Score: number;
  }>;
  PronunciationAssessment?: {
    AccuracyScore: number;
    NBestPhonemes?: Array<{
      Phoneme: string;
      Score: number;
    }>;
  };
}

export interface AzureWordResult {
  Word: string;
  Offset?: number;
  Duration?: number;
  AccuracyScore?: number;
  ErrorType?: string;
  PronunciationAssessment?: {
    AccuracyScore: number;
    ErrorType: string;
  };
  Phonemes?: AzurePhonemeResult[];
}

export interface AzureNBestResult {
  Confidence: number;
  Lexical: string;
  ITN: string;
  MaskedITN: string;
  Display: string;
  AccuracyScore?: number;
  FluencyScore?: number;
  CompletenessScore?: number;
  PronScore?: number;
  PronunciationAssessment?: {
    AccuracyScore: number;
    FluencyScore: number;
    CompletenessScore: number;
    PronScore: number;
  };
  Words?: AzureWordResult[];
}

export interface AzureRecognitionResult {
  RecognitionStatus: string;
  Offset?: number;
  Duration?: number;
  DisplayText?: string;
  NBest?: AzureNBestResult[];
}

export interface PhonemeScore {
  phoneme: string;
  accuracyScore: number;
  nBestPhonemes?: Array<{ phoneme: string; score: number }>;
}

export interface WordScore {
  word: string;
  accuracyScore: number;
  errorType: string;
  phonemes: PhonemeScore[];
}

export interface PronunciationResult {
  accuracyScore: number;
  pronunciationScore: number;
  completenessScore: number;
  fluencyScore: number;
  recognizedText: string;
  words: WordScore[];
  phonemes: PhonemeScore[];
  feedback: string;
}

function utf8ToBase64(str: string): string {
  if (typeof btoa === 'function') {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(str);
      let binary = '';
      for (let i = 0; i < data.length; i++) {
        binary += String.fromCharCode(data[i]);
      }
      return btoa(binary);
    } catch (e) {
      console.log('[Azure] btoa fallback triggered');
    }
  }
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const bytes = typeof TextEncoder !== 'undefined'
    ? Array.from(new TextEncoder().encode(str))
    : str.split('').map(c => c.charCodeAt(0));
  let result = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    result += chars[a >> 2];
    result += chars[((a & 3) << 4) | (b >> 4)];
    result += i + 1 < bytes.length ? chars[((b & 15) << 2) | (c >> 6)] : '=';
    result += i + 2 < bytes.length ? chars[c & 63] : '=';
  }
  return result;
}

export async function assessPronunciationViaServer(
  audioBlob: Blob,
  referenceText: string,
  language: string = 'fr-FR',
): Promise<PronunciationResult> {
  if (!referenceText || referenceText.trim().length === 0) {
    throw new Error('No reference text provided for pronunciation assessment.');
  }

  console.log('[AzureServer] Sending to server - language:', language, 'ref:', referenceText, 'audioSize:', audioBlob.size);

  const formData = new FormData();
  formData.append('audio', audioBlob, 'recording.wav');
  formData.append('referenceText', referenceText.trim());
  formData.append('language', language);
  formData.append('format', 'wav');

  const serverUrl = getServerUrl() || '/api/pronunciation-assessment';
  console.log('[AzureServer] Using server URL:', serverUrl);

  let response: Response;
  try {
    response = await fetch(serverUrl, {
      method: 'POST',
      body: formData,
    });
  } catch (fetchErr: any) {
    console.error('[AzureServer] Network error:', fetchErr?.message);
    throw new Error('SERVER_UNAVAILABLE');
  }

  if (!response.ok) {
    const errorBody = await response.text().catch(() => 'unknown');
    console.error('[AzureServer] Error:', response.status, errorBody);
    if (response.status === 500 && errorBody.includes('credentials')) {
      throw new Error('Azure Speech credentials not configured on server.');
    }
    throw new Error(`Server error (${response.status}): ${errorBody}`);
  }

  let data: any;
  try {
    data = await response.json();
  } catch (parseErr) {
    console.error('[AzureServer] Failed to parse JSON response');
    throw new Error('Invalid response from server.');
  }

  if (data.error) {
    console.error('[AzureServer] Server returned error:', data.error);
    throw new Error(data.error);
  }

  console.log('[AzureServer] Success - accuracy:', data.accuracyScore, 'pron:', data.pronunciationScore);

  const words: WordScore[] = (data.words || []).map((w: any) => ({
    word: w.word || '',
    accuracyScore: w.accuracyScore ?? 0,
    errorType: w.errorType ?? 'None',
    phonemes: (w.phonemes || []).map((p: any) => ({
      phoneme: p.phoneme || '',
      accuracyScore: p.accuracyScore ?? 0,
      nBestPhonemes: (p.nBestPhonemes || []).map((nb: any) => ({
        phoneme: nb.phoneme || nb.Phoneme || '',
        score: nb.score ?? nb.Score ?? 0,
      })),
    })),
  }));

  const allPhonemes = words.flatMap(w => w.phonemes);

  return {
    accuracyScore: data.accuracyScore ?? 0,
    pronunciationScore: data.pronunciationScore ?? 0,
    completenessScore: data.completenessScore ?? 0,
    fluencyScore: data.fluencyScore ?? 0,
    recognizedText: data.recognizedText || '',
    words,
    phonemes: allPhonemes.length > 0 ? allPhonemes : (data.phonemes || []).map((p: any) => ({
      phoneme: p.phoneme || '',
      accuracyScore: p.accuracyScore ?? 0,
      nBestPhonemes: (p.nBestPhonemes || []).map((nb: any) => ({
        phoneme: nb.phoneme || nb.Phoneme || '',
        score: nb.score ?? nb.Score ?? 0,
      })),
    })),
    feedback: data.feedback || '',
  };
}

export async function assessPronunciation(
  audioBlob: Blob,
  referenceText: string,
  language: string = 'fr-FR',
  contentTypeOverride?: string,
): Promise<PronunciationResult> {
  const apiKey = (process.env.EXPO_PUBLIC_AZURE_SPEECH_KEY || '').trim();
  const region = (process.env.EXPO_PUBLIC_AZURE_SPEECH_REGION || '').trim();

  if (!apiKey || !region) {
    console.error('[Azure] Missing credentials - key:', !!apiKey, 'region:', !!region);
    throw new Error('Azure Speech credentials not configured. Please check your API key and region settings.');
  }

  if (!referenceText || referenceText.trim().length === 0) {
    throw new Error('No reference text provided for pronunciation assessment.');
  }

  const pronunciationConfig = {
    ReferenceText: referenceText.trim(),
    GradingSystem: 'HundredMark',
    Granularity: 'Phoneme',
    Dimension: 'Comprehensive',
    EnableMiscue: true,
    PhonemeAlphabet: 'IPA',
    NBestPhonemeCount: 5,
  };

  const configBase64 = utf8ToBase64(JSON.stringify(pronunciationConfig));
  const endpoint = `https://${region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1`;
  const url = `${endpoint}?language=${language}&format=detailed`;

  const contentType = contentTypeOverride || 'audio/wav; codecs=audio/pcm; samplerate=16000';

  console.log('[Azure] Sending direct REST pronunciation assessment');
  console.log('[Azure] Reference:', referenceText);
  console.log('[Azure] Language:', language);
  console.log('[Azure] Region:', region);
  console.log('[Azure] Audio size:', audioBlob.size, 'bytes, type:', audioBlob.type || 'unknown');
  console.log('[Azure] Content-Type:', contentType);
  console.log('[Azure] Endpoint:', url);

  const audioArrayBuffer = await audioBlob.arrayBuffer();
  console.log('[Azure] ArrayBuffer size:', audioArrayBuffer.byteLength, 'bytes');

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': apiKey,
        'Pronunciation-Assessment': configBase64,
        'Content-Type': contentType,
        'Accept': 'application/json',
      },
      body: audioArrayBuffer,
    });
  } catch (fetchErr: any) {
    console.error('[Azure] Network error:', fetchErr?.message);
    throw new Error('Network error connecting to Azure. Check your internet connection and try again.');
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'unknown error');
    console.error('[Azure] API error:', response.status, errorText);
    if (response.status === 401 || response.status === 403) {
      throw new Error('Azure API key is invalid or expired. Please check your credentials.');
    }
    if (response.status === 429) {
      throw new Error('Too many requests. Please wait a moment and try again.');
    }
    throw new Error(`Azure Speech error (${response.status}): ${errorText}`);
  }

  let result: AzureRecognitionResult;
  try {
    result = await response.json();
  } catch (jsonErr) {
    console.error('[Azure] Failed to parse response as JSON');
    throw new Error('Received invalid response from Azure. Please try again.');
  }

  console.log('[Azure] Recognition status:', result.RecognitionStatus);
  console.log('[Azure] Full response:', JSON.stringify(result).substring(0, 500));

  if (result.NBest?.length) {
    const best = result.NBest[0];
    console.log('[Azure] NBest[0] Display:', best.Display);
    console.log('[Azure] NBest[0] has PronunciationAssessment:', !!best.PronunciationAssessment);
    if (best.PronunciationAssessment) {
      console.log('[Azure] Scores - Accuracy:', best.PronunciationAssessment.AccuracyScore,
        'Fluency:', best.PronunciationAssessment.FluencyScore,
        'Completeness:', best.PronunciationAssessment.CompletenessScore,
        'Pron:', best.PronunciationAssessment.PronScore);
    }
  }

  return parseResult(result, referenceText);
}

export async function assessPronunciationFromUri(
  fileUri: string,
  referenceText: string,
  language: string = 'fr-FR',
  contentType: string = 'audio/wav; codecs=audio/pcm; samplerate=16000',
): Promise<PronunciationResult> {
  const apiKey = (process.env.EXPO_PUBLIC_AZURE_SPEECH_KEY || '').trim();
  const region = (process.env.EXPO_PUBLIC_AZURE_SPEECH_REGION || '').trim();

  if (!apiKey || !region) {
    console.error('[Azure] Missing credentials - key:', !!apiKey, 'region:', !!region);
    throw new Error('Azure Speech credentials not configured. Please check your API key and region settings.');
  }

  if (!referenceText || referenceText.trim().length === 0) {
    throw new Error('No reference text provided for pronunciation assessment.');
  }

  const pronunciationConfig = {
    ReferenceText: referenceText.trim(),
    GradingSystem: 'HundredMark',
    Granularity: 'Phoneme',
    Dimension: 'Comprehensive',
    EnableMiscue: true,
    PhonemeAlphabet: 'IPA',
    NBestPhonemeCount: 5,
  };

  const configBase64 = utf8ToBase64(JSON.stringify(pronunciationConfig));
  const endpoint = `https://${region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1`;
  const url = `${endpoint}?language=${language}&format=detailed`;

  let fileSize = 0;
  try {
    const fileInfo = await getInfoAsync(fileUri);
    if (!fileInfo.exists) {
      throw new Error('Recording file not found on disk. Please try recording again.');
    }
    fileSize = (fileInfo as any).size ?? 0;
    console.log('[Azure] File exists, size:', fileSize, 'bytes');
  } catch (infoErr: any) {
    if (infoErr.message?.includes('not found')) throw infoErr;
    console.warn('[Azure] Could not get file info:', infoErr.message);
  }

  if (fileSize > 0 && fileSize < 200) {
    throw new Error('Recording too short or empty. Please speak clearly and try again.');
  }

  console.log('[Azure] Native upload from URI:', fileUri);
  console.log('[Azure] Reference:', referenceText);
  console.log('[Azure] Language:', language);
  console.log('[Azure] Region:', region);
  console.log('[Azure] Content-Type:', contentType);
  console.log('[Azure] Endpoint:', url);

  const requestHeaders: Record<string, string> = {
    'Ocp-Apim-Subscription-Key': apiKey,
    'Pronunciation-Assessment': configBase64,
    'Content-Type': contentType,
    'Accept': 'application/json',
  };

  let uploadResult: { status: number; body: string; headers: Record<string, string> };

  try {
    console.log('[Azure] Trying uploadAsync (BINARY_CONTENT)...');
    uploadResult = await uploadAsync(url, fileUri, {
      uploadType: FileSystemUploadType.BINARY_CONTENT,
      httpMethod: 'POST',
      headers: requestHeaders,
    });
    console.log('[Azure] uploadAsync succeeded, status:', uploadResult.status);
  } catch (uploadErr: any) {
    console.log('[Azure] uploadAsync failed:', uploadErr?.message, '- trying base64 fetch fallback');
    try {
      const base64Data = await readAsStringAsync(fileUri, { encoding: EncodingType.Base64 });
      console.log('[Azure] Read file as base64, length:', base64Data.length);
      const binaryStr = atob(base64Data);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      console.log('[Azure] Decoded to', bytes.length, 'bytes, sending via fetch...');

      const fetchResp = await fetch(url, {
        method: 'POST',
        headers: requestHeaders,
        body: bytes.buffer,
      });
      const respBody = await fetchResp.text();
      uploadResult = { status: fetchResp.status, body: respBody, headers: {} };
      console.log('[Azure] Fetch fallback status:', fetchResp.status);
    } catch (fallbackErr: any) {
      console.error('[Azure] Both upload methods failed. uploadAsync:', uploadErr?.message, 'fetch:', fallbackErr?.message);
      throw new Error(
        'Failed to upload audio to Azure. Please check your internet connection and try again.'
      );
    }
  }

  console.log('[Azure] Upload response status:', uploadResult.status);
  console.log('[Azure] Upload response body:', uploadResult.body?.substring(0, 500));

  if (uploadResult.status < 200 || uploadResult.status >= 300) {
    console.error('[Azure] Native upload API error:', uploadResult.status, uploadResult.body);
    if (uploadResult.status === 401 || uploadResult.status === 403) {
      throw new Error('Azure API key is invalid or expired. Please check your credentials.');
    }
    if (uploadResult.status === 429) {
      throw new Error('Too many requests. Please wait a moment and try again.');
    }
    throw new Error(`Azure Speech error (${uploadResult.status}): ${uploadResult.body}`);
  }

  let result: AzureRecognitionResult;
  try {
    result = JSON.parse(uploadResult.body);
  } catch (parseErr) {
    console.error('[Azure] Failed to parse response JSON:', uploadResult.body?.substring(0, 200));
    throw new Error('Received invalid response from Azure. Please try again.');
  }

  console.log('[Azure] Recognition status:', result.RecognitionStatus);
  if (result.NBest?.length) {
    const best = result.NBest[0];
    console.log('[Azure] NBest[0] Display:', best.Display);
    if (best.PronunciationAssessment) {
      console.log('[Azure] Scores - Accuracy:', best.PronunciationAssessment.AccuracyScore,
        'Fluency:', best.PronunciationAssessment.FluencyScore,
        'Completeness:', best.PronunciationAssessment.CompletenessScore,
        'Pron:', best.PronunciationAssessment.PronScore);
    }
  }

  return parseResult(result, referenceText);
}

export async function assessPronunciationFromUriViaServer(
  fileUri: string,
  referenceText: string,
  language: string = 'fr-FR',
  mimeType: string = 'audio/wav',
): Promise<PronunciationResult> {
  const serverUrl = getServerUrl();
  if (!serverUrl) {
    throw new Error('SERVER_UNAVAILABLE');
  }

  if (!referenceText || referenceText.trim().length === 0) {
    throw new Error('No reference text provided for pronunciation assessment.');
  }

  let fileSize = 0;
  try {
    const fileInfo = await getInfoAsync(fileUri);
    if (!fileInfo.exists) {
      throw new Error('Recording file not found on disk. Please try recording again.');
    }
    fileSize = (fileInfo as any).size ?? 0;
    console.log('[AzureServerNative] File exists, size:', fileSize, 'bytes');
  } catch (infoErr: any) {
    if (infoErr.message?.includes('not found')) throw infoErr;
    console.warn('[AzureServerNative] Could not get file info:', infoErr.message);
  }

  if (fileSize > 0 && fileSize < 200) {
    throw new Error('Recording too short or empty. Please speak clearly and try again.');
  }

  console.log('[AzureServerNative] Uploading to server:', serverUrl);
  console.log('[AzureServerNative] Reference:', referenceText);
  console.log('[AzureServerNative] Language:', language);
  console.log('[AzureServerNative] File URI:', fileUri);
  console.log('[AzureServerNative] MIME type:', mimeType);

  let uploadResult: { status: number; body: string; headers: Record<string, string> };

  try {
    uploadResult = await uploadAsync(serverUrl, fileUri, {
      uploadType: FileSystemUploadType.MULTIPART,
      httpMethod: 'POST',
      fieldName: 'audio',
      mimeType,
      parameters: {
        referenceText: referenceText.trim(),
        language,
        format: mimeType.includes('wav') ? 'wav' : mimeType.includes('ogg') ? 'ogg' : 'mp4',
      },
    });
    console.log('[AzureServerNative] Upload response status:', uploadResult.status);
  } catch (uploadErr: any) {
    console.error('[AzureServerNative] Upload failed:', uploadErr?.message);
    throw new Error('SERVER_UNAVAILABLE');
  }

  if (uploadResult.status < 200 || uploadResult.status >= 300) {
    console.error('[AzureServerNative] Server error:', uploadResult.status, uploadResult.body);
    throw new Error(`Server error (${uploadResult.status}): ${uploadResult.body}`);
  }

  let data: any;
  try {
    data = JSON.parse(uploadResult.body);
  } catch (parseErr) {
    console.error('[AzureServerNative] Failed to parse response');
    throw new Error('Invalid response from server.');
  }

  if (data.error) {
    console.error('[AzureServerNative] Server returned error:', data.error);
    throw new Error(data.error);
  }

  console.log('[AzureServerNative] Success - accuracy:', data.accuracyScore, 'pron:', data.pronunciationScore);

  const words: WordScore[] = (data.words || []).map((w: any) => ({
    word: w.word || '',
    accuracyScore: w.accuracyScore ?? 0,
    errorType: w.errorType ?? 'None',
    phonemes: (w.phonemes || []).map((p: any) => ({
      phoneme: p.phoneme || '',
      accuracyScore: p.accuracyScore ?? 0,
      nBestPhonemes: (p.nBestPhonemes || []).map((nb: any) => ({
        phoneme: nb.phoneme || nb.Phoneme || '',
        score: nb.score ?? nb.Score ?? 0,
      })),
    })),
  }));

  const allPhonemes = words.flatMap(w => w.phonemes);

  return {
    accuracyScore: data.accuracyScore ?? 0,
    pronunciationScore: data.pronunciationScore ?? 0,
    completenessScore: data.completenessScore ?? 0,
    fluencyScore: data.fluencyScore ?? 0,
    recognizedText: data.recognizedText || '',
    words,
    phonemes: allPhonemes.length > 0 ? allPhonemes : (data.phonemes || []).map((p: any) => ({
      phoneme: p.phoneme || '',
      accuracyScore: p.accuracyScore ?? 0,
      nBestPhonemes: (p.nBestPhonemes || []).map((nb: any) => ({
        phoneme: nb.phoneme || nb.Phoneme || '',
        score: nb.score ?? nb.Score ?? 0,
      })),
    })),
    feedback: data.feedback || '',
  };
}

function parseResult(
  result: AzureRecognitionResult,
  referenceText: string,
): PronunciationResult {
  if (result.RecognitionStatus !== 'Success' || !result.NBest?.length) {
    console.log('[Azure] Non-success status:', result.RecognitionStatus, 'NBest count:', result.NBest?.length ?? 0);
    let msg: string;
    switch (result.RecognitionStatus) {
      case 'NoMatch':
        msg = 'No speech detected. Please speak clearly and directly into the microphone.';
        break;
      case 'InitialSilenceTimeout':
        msg = 'No speech was heard. Start speaking right after pressing the record button.';
        break;
      case 'BabbleTimeout':
        msg = 'Too much background noise. Please find a quieter environment and try again.';
        break;
      case 'Error':
        msg = 'Azure could not process the audio. Please try recording again with a steady voice.';
        break;
      case 'EndOfDictation':
        msg = 'The recording ended unexpectedly. Please try speaking for a longer duration.';
        break;
      default:
        msg = `Recognition issue (${result.RecognitionStatus}). Please try again.`;
    }
    return {
      accuracyScore: 0,
      pronunciationScore: 0,
      completenessScore: 0,
      fluencyScore: 0,
      recognizedText: '',
      words: [],
      phonemes: [],
      feedback: msg,
    };
  }

  let best = result.NBest[0];
  let assessment = best.PronunciationAssessment;

  if (!assessment && best.AccuracyScore !== undefined) {
    console.log('[Azure] Scores found directly on NBest[0], wrapping...');
    assessment = {
      AccuracyScore: best.AccuracyScore ?? 0,
      FluencyScore: best.FluencyScore ?? 0,
      CompletenessScore: best.CompletenessScore ?? 0,
      PronScore: best.PronScore ?? 0,
    };
  }

  if (!assessment && result.NBest.length > 1) {
    console.log('[Azure] PronunciationAssessment missing from NBest[0], checking other entries...');
    for (let i = 1; i < result.NBest.length; i++) {
      const entry = result.NBest[i];
      if (entry.PronunciationAssessment) {
        best = entry;
        assessment = entry.PronunciationAssessment;
        console.log('[Azure] Found PronunciationAssessment in NBest[' + i + ']');
        break;
      } else if (entry.AccuracyScore !== undefined) {
        best = entry;
        assessment = {
          AccuracyScore: entry.AccuracyScore ?? 0,
          FluencyScore: entry.FluencyScore ?? 0,
          CompletenessScore: entry.CompletenessScore ?? 0,
          PronScore: entry.PronScore ?? 0,
        };
        console.log('[Azure] Found direct scores in NBest[' + i + ']');
        break;
      }
    }
  }

  if (!assessment) {
    console.warn('[Azure] PronunciationAssessment missing from ALL NBest entries');
    console.warn('[Azure] Full response:', JSON.stringify(result).substring(0, 1000));
    throw new Error(
      'ASSESSMENT_DATA_MISSING: Speech was recognized but pronunciation scores were not returned by Azure. ' +
      'This usually happens when the assessment request is blocked by browser security (CORS). ' +
      'Please try on a mobile device for the best experience.'
    );
  }

  const words: WordScore[] = (best.Words || []).map(w => ({
    word: w.Word,
    accuracyScore: w.PronunciationAssessment?.AccuracyScore ?? w.AccuracyScore ?? 0,
    errorType: w.PronunciationAssessment?.ErrorType ?? w.ErrorType ?? 'None',
    phonemes: (w.Phonemes || []).map(p => ({
      phoneme: p.Phoneme,
      accuracyScore: p.PronunciationAssessment?.AccuracyScore ?? p.AccuracyScore ?? 0,
      nBestPhonemes: (p.PronunciationAssessment?.NBestPhonemes ?? p.NBestPhonemes ?? []).map(nb => ({
        phoneme: nb.Phoneme,
        score: nb.Score,
      })),
    })),
  }));

  const allPhonemes = words.flatMap(w => w.phonemes);

  return {
    accuracyScore: assessment.AccuracyScore ?? 0,
    pronunciationScore: assessment.PronScore ?? 0,
    completenessScore: assessment.CompletenessScore ?? 0,
    fluencyScore: assessment.FluencyScore ?? 0,
    recognizedText: best.Display || '',
    words,
    phonemes: allPhonemes,
    feedback: generateFeedback(assessment, words),
  };
}

function generateFeedback(
  assessment: { AccuracyScore: number; FluencyScore: number; CompletenessScore: number },
  words: WordScore[],
): string {
  const parts: string[] = [];
  const { AccuracyScore: accuracy, CompletenessScore: completeness } = assessment;

  if (accuracy >= 90) {
    parts.push('Excellent! Very close to native pronunciation.');
  } else if (accuracy >= 75) {
    parts.push('Good pronunciation. Keep refining the details.');
  } else if (accuracy >= 55) {
    parts.push('Decent attempt — focus on the highlighted sounds.');
  } else {
    parts.push('Keep practicing! Listen to the native audio and try again.');
  }

  const weakPhonemes = words
    .flatMap(w => w.phonemes)
    .filter(p => p.accuracyScore < 60);

  if (weakPhonemes.length > 0) {
    const unique = [...new Set(weakPhonemes.map(p => p.phoneme))];
    if (unique.length <= 3) {
      parts.push(`Work on: ${unique.map(p => '/' + p + '/').join(', ')}.`);
    } else {
      parts.push('Several sounds need work — see the phoneme breakdown.');
    }

    for (const wp of weakPhonemes.slice(0, 2)) {
      if (wp.nBestPhonemes && wp.nBestPhonemes.length >= 2) {
        const heard = wp.nBestPhonemes[0];
        if (heard && heard.phoneme !== wp.phoneme) {
          parts.push(`Your /${wp.phoneme}/ sounded like /${heard.phoneme}/.`);
        }
      }
    }
  }

  if (completeness < 80) {
    parts.push('Make sure to pronounce every part of the word clearly.');
  }

  const omitted = words.filter(w => w.errorType === 'Omission');
  if (omitted.length > 0) {
    parts.push(`Missing: ${omitted.map(w => '"' + w.word + '"').join(', ')}.`);
  }

  const inserted = words.filter(w => w.errorType === 'Insertion');
  if (inserted.length > 0) {
    parts.push(`Extra sounds detected: ${inserted.map(w => '"' + w.word + '"').join(', ')}.`);
  }

  return parts.join(' ');
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

function encodeWAV(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, samples.length * 2, true);

  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

export async function convertBlobToWav(
  blob: Blob,
  targetSampleRate: number = 16000,
): Promise<Blob> {
  if (Platform.OS !== 'web') {
    return blob;
  }

  if (blob.size < 100) {
    console.warn('[Azure] Blob too small for WAV conversion:', blob.size, 'bytes');
    throw new Error('Audio recording is too short. Please speak for at least 1 second.');
  }

  const AudioCtx =
    (window as any).AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtx) {
    throw new Error('Audio processing not supported in this browser.');
  }

  let arrayBuffer: ArrayBuffer;
  try {
    arrayBuffer = await blob.arrayBuffer();
  } catch (bufErr: any) {
    console.error('[Azure] Failed to read audio blob:', bufErr?.message);
    throw new Error('Failed to read audio data. Please try recording again.');
  }

  console.log('[Azure] Converting blob to WAV, input size:', arrayBuffer.byteLength, 'bytes');

  const audioContext = new AudioCtx();

  try {
    let audioBuffer: AudioBuffer;
    try {
      audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
    } catch (decodeErr: any) {
      console.error('[Azure] decodeAudioData failed:', decodeErr?.message);
      throw new Error('Could not decode audio. Please try speaking louder and longer.');
    }

    if (audioBuffer.duration < 0.3) {
      console.warn('[Azure] Audio too short:', audioBuffer.duration, 's');
      throw new Error('Recording too short. Please speak for at least 1 second.');
    }

    const offlineContext = new OfflineAudioContext(
      1,
      Math.ceil(audioBuffer.duration * targetSampleRate),
      targetSampleRate,
    );

    const source = offlineContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(offlineContext.destination);
    source.start();

    const rendered = await offlineContext.startRendering();
    const pcm = rendered.getChannelData(0);

    let maxAmp = 0;
    for (let i = 0; i < pcm.length; i++) {
      const abs = Math.abs(pcm[i]);
      if (abs > maxAmp) maxAmp = abs;
    }

    console.log(
      '[Azure] WAV conversion:',
      audioBuffer.duration.toFixed(2),
      's,',
      pcm.length,
      'samples, maxAmp:',
      maxAmp.toFixed(4),
    );

    if (maxAmp < 0.001) {
      console.warn('[Azure] Audio appears silent, maxAmp:', maxAmp);
    }

    return encodeWAV(pcm, targetSampleRate);
  } finally {
    try { await audioContext.close(); } catch (_e) {}
  }
}
