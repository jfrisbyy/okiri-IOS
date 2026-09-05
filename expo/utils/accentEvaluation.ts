import { generateObject } from '@rork-ai/toolkit-sdk';
import { z } from 'zod';
import type { PronunciationResult, WordScore, PhonemeScore } from '@/utils/azurePronunciation';
import type { FrenchRegion, RegionalSound } from '@/data/regionalAccents';
import type { DualAudioComparison } from '@/utils/accentComparison';
import { formatComparisonForAI } from '@/utils/accentComparison';

export interface AccentFeatureScore {
  feature: string;
  score: number;
  detected: boolean;
  feedback: string;
}

export interface AccentEvaluationResult {
  accentMatchScore: number;
  accentLabel: string;
  featureScores: AccentFeatureScore[];
  overallFeedback: string;
  detailedTips: string[];
  strongPoints: string[];
  weakPoints: string[];
}

const accentEvaluationSchema = z.object({
  accentMatchScore: z.number().min(0).max(100).describe('How closely the speaker matched the target accent (0-100)'),
  accentLabel: z.string().describe('Short label like "Strong match", "Partial match", "Needs work", "Not yet matching"'),
  featureScores: z.array(z.object({
    feature: z.string().describe('Name of the accent feature being evaluated'),
    score: z.number().min(0).max(100).describe('How well this specific feature was executed'),
    detected: z.boolean().describe('Whether this accent feature was detected in the speech'),
    feedback: z.string().describe('Brief specific feedback for this feature'),
  })).describe('Scores for each characteristic accent feature'),
  overallFeedback: z.string().describe('2-3 sentence overall assessment of accent quality'),
  detailedTips: z.array(z.string()).describe('Specific actionable tips for improving accent'),
  strongPoints: z.array(z.string()).describe('What the speaker did well for this accent'),
  weakPoints: z.array(z.string()).describe('What needs improvement for this accent'),
});

function buildPhonemeAnalysis(words: WordScore[]): string {
  if (!words || words.length === 0) return 'No word-level data available.';

  const lines: string[] = [];
  for (const w of words) {
    const phonemeDetails = w.phonemes.map(p => {
      let detail = `/${p.phoneme}/ (score: ${Math.round(p.accuracyScore)})`;
      if (p.nBestPhonemes && p.nBestPhonemes.length > 0) {
        const alternatives = p.nBestPhonemes
          .slice(0, 3)
          .map(nb => `/${nb.phoneme}/: ${Math.round(nb.score)}`)
          .join(', ');
        detail += ` [heard alternatives: ${alternatives}]`;
      }
      return detail;
    }).join('; ');

    lines.push(`Word "${w.word}" (accuracy: ${Math.round(w.accuracyScore)}, error: ${w.errorType}): ${phonemeDetails}`);
  }
  return lines.join('\n');
}

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

export async function evaluateAccent(
  azureResult: PronunciationResult,
  targetRegion: FrenchRegion,
  referenceText: string,
  targetIpa: string,
  dualComparison?: DualAudioComparison,
): Promise<AccentEvaluationResult> {
  console.log('[AccentEval] Starting AI accent evaluation for', targetRegion.id);
  console.log('[AccentEval] Reference:', referenceText);
  console.log('[AccentEval] Recognized:', azureResult.recognizedText);
  console.log('[AccentEval] Dual comparison available:', !!dualComparison);

  const phonemeAnalysis = buildPhonemeAnalysis(azureResult.words);
  const accentProfile = buildAccentProfile(targetRegion);

  const dualComparisonSection = dualComparison
    ? `
CRITICAL DATA — DUAL AUDIO COMPARISON:
We generated a native accent audio using Azure TTS with the regional voice for ${targetRegion.name}, then ran Azure pronunciation assessment on BOTH the native accent audio AND the learner's recording.
This gives us a phoneme-by-phoneme comparison of what the native accent voice produced vs what the learner produced.

${formatComparisonForAI(dualComparison)}

USE THIS DATA AS YOUR PRIMARY SCORING METHOD:
- Compare the phonemes Azure heard from the REFERENCE (native accent TTS) against what it heard from the USER
- Where the user's phonemes match the reference's phonemes, the accent is correct
- Where they differ, the user is NOT matching the target accent
- The phoneme similarity score gives a baseline, but you should also consider which specific accent features are present/missing
`
    : '';

  const prompt = `You are an expert French phonetics and accent coach. Your job is to evaluate how well a language learner matched a specific REGIONAL FRENCH ACCENT — not just whether they pronounced the words correctly.

IMPORTANT: Azure Pronunciation Assessment only checks if words were spoken clearly. It does NOT evaluate accent quality. YOU must evaluate accent quality by analyzing the phoneme data.

${accentProfile}

REFERENCE TEXT: "${referenceText}"
TARGET IPA FOR THIS ACCENT: ${targetIpa}
WHAT AZURE HEARD FROM LEARNER: "${azureResult.recognizedText}"
${dualComparisonSection}
LEARNER'S PHONEME-LEVEL DATA:
${phonemeAnalysis}

AZURE BASIC SCORES (for reference only — these measure word clarity, NOT accent):
- Accuracy: ${Math.round(azureResult.accuracyScore)}
- Fluency: ${Math.round(azureResult.fluencyScore)}
- Completeness: ${Math.round(azureResult.completenessScore)}
- Pronunciation: ${Math.round(azureResult.pronunciationScore)}

YOUR TASK:
1. ${dualComparison ? 'PRIMARILY use the dual audio comparison data — compare the phonemes the native accent voice produced vs what the learner produced' : 'Analyze the NBest phoneme alternatives to determine what sounds the speaker ACTUALLY produced'}
2. Compare those sounds against the TARGET ACCENT's characteristic features listed above
3. Score each accent feature individually (did they affricate T/D for Québécois? Did they elongate vowels for Swiss/Belgian? etc.)
4. Give an overall accent match score that reflects how close they sound to a native speaker of this SPECIFIC regional accent
5. Be honest — if someone just spoke standard French clearly, that should NOT score high for a regional accent like Québécois
${dualComparison ? '6. If the phoneme similarity score is low AND the user phonemes differ significantly from the reference phonemes, score accordingly — the user is not matching the accent' : ''}

A speaker who says all words correctly in standard French should score LOW for regional accents (Québécois, Belgian, Swiss) because they're missing the distinctive accent features. Only Metropolitan French (fr-FR) should score moderately for "standard" pronunciation.

Be encouraging but honest. Give specific, actionable feedback about which accent features to practice.`;

  try {
    const result = await generateObject({
      messages: [{ role: 'user', content: prompt }],
      schema: accentEvaluationSchema,
    });

    console.log('[AccentEval] AI evaluation complete - accent match:', result.accentMatchScore);
    return result;
  } catch (err: any) {
    console.error('[AccentEval] AI evaluation failed:', err?.message);
    return buildFallbackEvaluation(azureResult, targetRegion, dualComparison);
  }
}

function buildFallbackEvaluation(
  azureResult: PronunciationResult,
  targetRegion: FrenchRegion,
  dualComparison?: DualAudioComparison,
): AccentEvaluationResult {
  const isStandard = targetRegion.id === 'fr-FR';

  let baseScore: number;
  if (dualComparison) {
    baseScore = Math.round(dualComparison.phonemeSimilarityScore * 0.8);
  } else {
    baseScore = isStandard
      ? Math.round(azureResult.pronunciationScore * 0.7)
      : Math.round(azureResult.pronunciationScore * 0.3);
  }

  return {
    accentMatchScore: Math.min(baseScore, 50),
    accentLabel: 'Unable to analyze',
    featureScores: targetRegion.characteristicSounds.map(s => ({
      feature: s.sound,
      score: 0,
      detected: false,
      feedback: 'AI evaluation unavailable — try again for detailed analysis.',
    })),
    overallFeedback: dualComparison
      ? `Phoneme similarity to native accent: ${dualComparison.phonemeSimilarityScore}%. AI detailed analysis unavailable — try again.`
      : 'The AI accent coach could not analyze your recording. Your basic pronunciation scores from Azure are shown above. Please try recording again for a full accent evaluation.',
    detailedTips: ['Try recording in a quieter environment', 'Speak clearly and at a natural pace', 'Listen to the regional audio example before recording'],
    strongPoints: azureResult.pronunciationScore > 70 ? ['Clear word pronunciation'] : [],
    weakPoints: ['Accent evaluation unavailable'],
  };
}
