import type { FrenchRegion } from '@/data/regionalAccents';
import type { AccentEvaluationResult } from '@/utils/accentEvaluation';
import { getReferenceAudioBase64 } from '@/utils/accentComparison';

function buildAccentProfile(region: FrenchRegion): string {
  const parts: string[] = [];
  parts.push(`Target Accent: ${region.name} (${region.id})`);
  parts.push(`Accent Identity: ${region.accentIdentity}`);
  parts.push('');
  parts.push('CHARACTERISTIC SOUNDS TO LISTEN FOR:');

  for (const sound of region.characteristicSounds) {
    parts.push(`- ${sound.sound} (${sound.ipa}): ${sound.description}`);
    if (sound.examples.length > 0) {
      const exs = sound.examples.map(e =>
        `"${e.word}": standard ${e.standardPronunciation} → regional ${e.regionalPronunciation}`
      ).join('; ');
      parts.push(`  Examples: ${exs}`);
    }
  }

  return parts.join('\n');
}



export async function evaluateAccentWithGPT4o(
  userAudioBase64: string,
  userAudioMimeType: string,
  targetRegion: FrenchRegion,
  referenceText: string,
  targetIpa: string,
): Promise<AccentEvaluationResult> {
  console.log('[GPT4oAccent] Starting direct audio accent evaluation');
  console.log('[GPT4oAccent] Region:', targetRegion.id, 'Text:', referenceText);
  console.log('[GPT4oAccent] User audio base64 length:', userAudioBase64.length, 'mimeType:', userAudioMimeType);

  let referenceBase64: string;
  try {
    referenceBase64 = await getReferenceAudioBase64(targetRegion.id, referenceText);
    console.log('[GPT4oAccent] Reference audio ready, base64 length:', referenceBase64.length);
  } catch (refErr: any) {
    console.error('[GPT4oAccent] Failed to generate reference audio:', refErr?.message);
    throw new Error('Could not generate reference accent audio. Please try again.');
  }

  const accentProfile = buildAccentProfile(targetRegion);

  const prompt = `You are an expert French phonetics and accent coach. You will hear TWO audio recordings and must compare them:

AUDIO 1 (FIRST): This is the REFERENCE — a native speaker with the ${targetRegion.name} regional accent saying: "${referenceText}"
AUDIO 2 (SECOND): This is the LEARNER'S recording — their attempt at mimicking the ${targetRegion.name} accent saying the same phrase.

${accentProfile}

TARGET IPA FOR THIS ACCENT: ${targetIpa}

YOUR TASK — LISTEN TO BOTH AUDIO FILES CAREFULLY:
1. Listen to the REFERENCE audio to hear how the native accent sounds
2. Listen to the LEARNER'S audio to hear their attempt
3. Compare the learner's pronunciation, intonation, rhythm, vowel quality, and consonant production to the reference
4. Evaluate how closely the learner matches each characteristic accent feature
5. Score each accent feature individually based on what you HEAR
6. Give an overall accent match score reflecting how close the learner sounds to the reference

CRITICAL: Base your evaluation on what you actually HEAR in the audio, not on text analysis. Compare the acoustic qualities directly.

A speaker who says all words correctly in standard French should score LOW for regional accents (Québécois, Belgian, Swiss) because they're missing the distinctive accent features.

SCORING GUIDE:
- 80-100: Clearly recognizable as the target accent, very close to reference
- 60-79: Some regional features present but inconsistent compared to reference
- 40-59: Mostly standard French with hints of regional color
- 20-39: Standard French pronunciation, missing most regional features heard in reference
- 0-19: Very different from the target accent / reference audio

Be encouraging but honest. Give specific, actionable feedback about which accent features to practice based on what you heard.

RESPOND WITH ONLY A JSON OBJECT (no markdown, no code blocks, no extra text). Use this exact schema:
{
  "accentMatchScore": <number 0-100>,
  "accentLabel": "<string>",
  "featureScores": [{"feature": "<string>", "score": <number 0-100>, "detected": <boolean>, "feedback": "<string>"}],
  "overallFeedback": "<string>",
  "detailedTips": ["<string>"],
  "strongPoints": ["<string>"],
  "weakPoints": ["<string>"]
}`;

  try {
    const openRouterKey = (process.env.EXPO_PUBLIC_OPENROUTER_API_KEY || '').trim();
    if (!openRouterKey) {
      throw new Error('OpenRouter API key not configured');
    }

    const userAudioFormat = userAudioMimeType.includes('webm') ? 'webm' : userAudioMimeType.includes('mp4') || userAudioMimeType.includes('m4a') ? 'mp4' : 'wav';

    console.log('[GPT4oAccent] === STARTING OPENROUTER REQUEST ===');
    console.log('[GPT4oAccent] Model: openai/gpt-audio-mini');
    console.log('[GPT4oAccent] Reference audio base64 length:', referenceBase64.length);
    console.log('[GPT4oAccent] Reference audio first 50 chars:', referenceBase64.substring(0, 50));
    console.log('[GPT4oAccent] User audio base64 length:', userAudioBase64.length);
    console.log('[GPT4oAccent] User audio first 50 chars:', userAudioBase64.substring(0, 50));
    console.log('[GPT4oAccent] User audio format resolved to:', userAudioFormat);
    console.log('[GPT4oAccent] Prompt length:', prompt.length);

    const requestBody = {
      model: 'openai/gpt-audio-mini',
      messages: [{
        role: 'user' as const,
        content: [
          { type: 'text', text: prompt },
          {
            type: 'input_audio',
            input_audio: {
              data: referenceBase64,
              format: 'wav',
            },
          },
          {
            type: 'input_audio',
            input_audio: {
              data: userAudioBase64,
              format: userAudioFormat,
            },
          },
        ],
      }],
      temperature: 0.3,
      max_tokens: 2000,
    };

    const bodyString = JSON.stringify(requestBody);
    console.log('[GPT4oAccent] Request body size (chars):', bodyString.length);
    console.log('[GPT4oAccent] Request body preview (first 300):', bodyString.substring(0, 300));
    console.log('[GPT4oAccent] Number of content parts:', requestBody.messages[0].content.length);

    console.log('[GPT4oAccent] Sending fetch to OpenRouter...');
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openRouterKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://rork.app',
      },
      body: bodyString,
    });

    console.log('[GPT4oAccent] Response received');
    console.log('[GPT4oAccent] Response status:', response.status);
    console.log('[GPT4oAccent] Response status text:', response.statusText);
    console.log('[GPT4oAccent] Response headers content-type:', response.headers.get('content-type'));

    const responseText = await response.text();
    console.log('[GPT4oAccent] Full response text length:', responseText.length);
    console.log('[GPT4oAccent] Full response text (first 1000):', responseText.substring(0, 1000));

    if (!response.ok) {
      console.error('[GPT4oAccent] === OPENROUTER ERROR ===');
      console.error('[GPT4oAccent] Status:', response.status);
      console.error('[GPT4oAccent] Body:', responseText);
      throw new Error(`OpenRouter API error (${response.status}): ${responseText}`);
    }

    let data: any;
    try {
      data = JSON.parse(responseText);
      console.log('[GPT4oAccent] Parsed OpenRouter response OK');
      console.log('[GPT4oAccent] Response keys:', Object.keys(data));
      console.log('[GPT4oAccent] Choices count:', data?.choices?.length ?? 'N/A');
      if (data?.choices?.[0]) {
        console.log('[GPT4oAccent] Choice[0] keys:', Object.keys(data.choices[0]));
        console.log('[GPT4oAccent] Message keys:', data.choices[0]?.message ? Object.keys(data.choices[0].message) : 'no message');
        console.log('[GPT4oAccent] Finish reason:', data.choices[0]?.finish_reason);
      }
      if (data?.error) {
        console.error('[GPT4oAccent] API returned error object:', JSON.stringify(data.error));
        throw new Error(`OpenRouter API error: ${JSON.stringify(data.error)}`);
      }
    } catch (jsonErr: any) {
      if (jsonErr.message?.includes('OpenRouter API error:')) throw jsonErr;
      console.error('[GPT4oAccent] Failed to parse OpenRouter response as JSON:', jsonErr?.message);
      console.error('[GPT4oAccent] Full response (first 1000):', responseText.substring(0, 1000));
      throw new Error('OpenRouter returned non-JSON response');
    }

    let rawResponse = data?.choices?.[0]?.message?.content || '';

    if (!rawResponse && data?.choices?.[0]?.message?.audio?.transcript) {
      rawResponse = data.choices[0].message.audio.transcript;
      console.log('[GPT4oAccent] Using audio transcript as content, length:', rawResponse.length);
    }
    
    if (!rawResponse) {
      console.error('[GPT4oAccent] Empty content in response.');
      console.error('[GPT4oAccent] Full data dump:', JSON.stringify(data).substring(0, 2000));
      throw new Error('OpenRouter returned empty content');
    }

    console.log('[GPT4oAccent] === RAW MODEL RESPONSE ===');
    console.log('[GPT4oAccent] Raw response length:', rawResponse.length);
    console.log('[GPT4oAccent] Raw response full (first 1000):', rawResponse.substring(0, 1000));
    console.log('[GPT4oAccent] Raw response char codes (first 20):', Array.from(rawResponse.substring(0, 20)).map((c) => (c as string).charCodeAt(0)));

    const parsed = parseAccentResponse(rawResponse, targetRegion);
    console.log('[GPT4oAccent] === EVALUATION COMPLETE ===');
    console.log('[GPT4oAccent] Accent match score:', parsed.accentMatchScore);
    console.log('[GPT4oAccent] Accent label:', parsed.accentLabel);
    console.log('[GPT4oAccent] Feature scores count:', parsed.featureScores.length);
    return parsed;
  } catch (err: any) {
    console.error('[GPT4oAccent] Evaluation failed:', err?.message);
    return buildFallbackResult(targetRegion);
  }
}

function extractJSON(text: string): string | null {
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) return codeBlockMatch[1].trim();

  const braceMatch = text.match(/\{[\s\S]*\}/);
  if (braceMatch) return braceMatch[0].trim();

  return null;
}

function parseAccentResponse(raw: string, targetRegion: FrenchRegion): AccentEvaluationResult {
  const jsonStr = extractJSON(raw);
  if (!jsonStr) {
    console.warn('[GPT4oAccent] No JSON found in response, building from text');
    return buildTextBasedResult(raw, targetRegion);
  }

  try {
    const obj = JSON.parse(jsonStr);
    return {
      accentMatchScore: typeof obj.accentMatchScore === 'number' ? obj.accentMatchScore : 50,
      accentLabel: obj.accentLabel || 'Analysis complete',
      featureScores: Array.isArray(obj.featureScores) ? obj.featureScores.map((fs: any) => ({
        feature: fs.feature || 'Unknown',
        score: typeof fs.score === 'number' ? fs.score : 50,
        detected: !!fs.detected,
        feedback: fs.feedback || '',
      })) : [],
      overallFeedback: obj.overallFeedback || 'Evaluation complete.',
      detailedTips: Array.isArray(obj.detailedTips) ? obj.detailedTips : [],
      strongPoints: Array.isArray(obj.strongPoints) ? obj.strongPoints : [],
      weakPoints: Array.isArray(obj.weakPoints) ? obj.weakPoints : [],
    };
  } catch (parseErr: any) {
    console.error('[GPT4oAccent] JSON parse failed:', parseErr?.message, 'attempting text extraction');
    return buildTextBasedResult(raw, targetRegion);
  }
}

function buildTextBasedResult(raw: string, targetRegion: FrenchRegion): AccentEvaluationResult {
  const scoreMatch = raw.match(/(\d{1,3})\s*(?:\/\s*100|%|out of 100)/i);
  const score = scoreMatch ? Math.min(100, parseInt(scoreMatch[1], 10)) : 40;

  return {
    accentMatchScore: score,
    accentLabel: score >= 70 ? 'Good match' : score >= 40 ? 'Partial match' : 'Needs work',
    featureScores: targetRegion.characteristicSounds.map(s => ({
      feature: s.sound,
      score: 0,
      detected: false,
      feedback: 'Could not parse detailed feature scores.',
    })),
    overallFeedback: raw.substring(0, 500),
    detailedTips: ['Listen to the regional audio example before recording', 'Focus on mimicking rhythm and intonation'],
    strongPoints: [],
    weakPoints: ['Detailed analysis unavailable — try again'],
  };
}

function buildFallbackResult(targetRegion: FrenchRegion): AccentEvaluationResult {
  return {
    accentMatchScore: 0,
    accentLabel: 'Unable to analyze',
    featureScores: targetRegion.characteristicSounds.map(s => ({
      feature: s.sound,
      score: 0,
      detected: false,
      feedback: 'Audio evaluation unavailable — try again.',
    })),
    overallFeedback: 'The AI accent coach could not analyze your recording at this time. Please try again. Make sure to speak clearly and at a natural pace.',
    detailedTips: [
      'Listen to the regional audio example several times before recording',
      'Try to mimic the rhythm and intonation, not just the words',
      'Record in a quiet environment for best results',
    ],
    strongPoints: [],
    weakPoints: ['Accent evaluation unavailable — please retry'],
  };
}
