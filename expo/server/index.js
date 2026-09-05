const express = require('express');
const OpenAI = require('openai');
const path = require('path');
const multer = require('multer');
const sdk = require('microsoft-cognitiveservices-speech-sdk');
const { exec } = require('child_process');
const fs = require('fs');
const os = require('os');

const dubCache = new Map();
const DUB_DEFAULT_VOICE_ID = 'pFZP5JQG7iQjIQuC4Bku'; // Lily - French female voice

let dubRequestTimestamps = [];
function checkDubRateLimit() {
  const now = Date.now();
  dubRequestTimestamps = dubRequestTimestamps.filter(t => now - t < 1000);
  if (dubRequestTimestamps.length >= 10) {
    return false;
  }
  dubRequestTimestamps.push(now);
  return true;
}

function getArgValue(flag) {
  const flagIndex = process.argv.indexOf(flag);
  if (flagIndex === -1) {
    return undefined;
  }

  return process.argv[flagIndex + 1];
}

const requestedPort = getArgValue('--port') || getArgValue('-p');
const requestedHost = getArgValue('--host');

const app = express();
app.use(express.json({ limit: '10mb' }));

console.log('[Server] Boot args:', JSON.stringify({
  argv: process.argv.slice(2),
  requestedPort: requestedPort || null,
  requestedHost: requestedHost || null,
  envPort: process.env.PORT || null,
}));

const upload = multer({ storage: multer.memoryStorage() });

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || '',
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || 'https://api.openai.com/v1',
});

const EXTRACTION_PROMPT = `You are an AI language TEACHER, not a translator or grammar checker.

Your job is to TEACH based on learner mistakes and fluency development.

IMPORTANT PHILOSOPHY:
Learner input is a SIGNAL, not a sentence to reuse.
If the learner's attempt is incorrect, fragmented, or unstable,
you must infer WHAT CONCEPT they are struggling with
and build lessons around that concept using clean, native examples.

FLUENCY SUGGESTIONS vs GRAMMAR ERRORS:
If "isFluencySuggestion" is true, this is NOT a grammar error.
The learner's phrase is grammatically correct but could sound more natural.
For fluency suggestions, phrase questions positively:
- "A more natural way to say..."
- "Another way to express..."
- "A native speaker might say..."
- "Which phrase sounds more fluent?"
Do NOT treat fluency suggestions as mistakes to correct.

LISTENING COMPREHENSION GAPS:
If the sourceType is "listening", generate comprehension-focused questions:
- "What does this phrase mean?" (with multiple choice English options)
- "What was said in this exchange?" (fill in the blank)
- "Translate what you heard: ___"
- "What is the speaker asking/saying/suggesting?"
Focus on testing understanding of spoken French, not correction of errors.

------------------------------------
INPUT:
Learner's French attempt: "{frenchAttempt}"
What they intended (English): "{englishIntent}"
Error context: "{explanation}"
Category: {category}
Source type: {sourceType}
Is fluency suggestion (not an error): {isFluencySuggestion}

------------------------------------
STEP 1 — CONCEPT EXTRACTION (MANDATORY)

Analyze the learner_attempt and identify:
• the learner's intended meaning
• the underlying linguistic concept causing difficulty

Examples of concepts:
• Negation structure (ne...pas, ne...rien, ne...jamais)
• Verb + infinitive usage
• Subjunctive vs indicative
• Word order
• Tense selection (passé composé vs imparfait)
• Gender agreement
• Formal vs informal register (tu/vous)
• Natural phrasing vs literal translation

DO NOT judge the learner_attempt as "invalid".
Instead, infer what they were TRYING to express.

------------------------------------
STEP 2 — CANONICAL TEACHING TARGET

From the extracted concept, generate:
• 2-3 clean, native-speaker-correct example sentences
• These sentences must be grammatically correct
• These sentences must clearly demonstrate the concept
• NEVER reuse the broken learner_attempt as a question source

These canonical sentences are the ONLY sentences you may use in questions.

------------------------------------
STEP 3 — GENERATE PRACTICE QUESTIONS

Generate 5-6 varied practice questions focused on the concept.

ALLOWED QUESTION TYPES:
• multiple_choice: Meaning/comprehension OR choose correct form
• fill_blank: Sentence completion with missing word
• correction: Fix a deliberately flawed sentence YOU create
• translation: Translate English to French using the concept
• production: Type the correct French form

CRITICAL RULES FOR MULTIPLE CHOICE:
• The "choices" array MUST contain the "correctAnswer" exactly
• Provide 3-4 total choices including the correct one
• Distractors must be plausible but clearly wrong
• NO placeholder options like "other" or "none of the above"
• For English meaning questions: ALL choices must be in English
• For French form questions: ALL choices must be in French

------------------------------------
DIVERSITY REQUIREMENT (CRITICAL):

Each question MUST use a DIFFERENT sentence context. Vary:
• Subject pronouns: je, tu, il, elle, on, nous, vous, ils, elles
• Verbs: Use different verbs demonstrating the same concept
• Situations: Work, school, travel, family, hobbies, etc.
• Tenses: If teaching a tense, show it with various verbs

EXAMPLE OF BAD OUTPUT (same phrase repeated):
Question 1: "What does 'hier soir j'ai pu' mean?"
Question 2: "Complete: Hier soir, j'ai ___ dormir"
Question 3: "Translate: 'Last night I was able to...'"
→ ALL use the same "hier soir" context = REJECTED

EXAMPLE OF GOOD OUTPUT (diverse contexts):
Question 1: "What does 'J'ai pu finir mon travail' mean?"
Question 2: "Complete: Elle a ___ comprendre le problème"
Question 3: "Translate: 'We were able to leave early'"
Question 4: "Which is correct: 'Ils ont pu / Ils pouvaient' for a completed action?"
→ Different subjects, contexts, verbs = ACCEPTED

------------------------------------
RESPONSE FORMAT (JSON):
{
  "conceptLabel": "Brief concept name (e.g., 'French negation with rien')",
  "teachingFocus": "One sentence explaining what the learner needs to understand",
  "category": "vocabulary" | "grammar" | "pronunciation" | "phrasing" | "register",
  "canonicalExamples": [
    { "french": "Clean correct French sentence", "english": "English translation" },
    { "french": "Another example", "english": "Translation" }
  ],
  "questions": [
    {
      "type": "multiple_choice",
      "question": "What does 'Je ne veux rien' mean?",
      "correctAnswer": "I don't want anything",
      "choices": ["I don't want anything", "I want something", "I want everything", "I don't want to"],
      "hint": "Think about what 'rien' means in negation"
    }
  ]
}

------------------------------------
QUALITY CHECK (STRICT):
Before finalizing, verify:
• Every multiple_choice question has correctAnswer inside choices
• All French examples are grammatically correct
• Questions teach the CONCEPT using VARIED contexts, not the original phrase
• Mix of recognition and production question types
• Each question uses different subject/verb combinations
• NO question repeats the learner's exact original attempt
• Would a human French teacher use this lesson?`;

app.post('/api/extract-concept', async (req, res) => {
  try {
    const { frenchAttempt, englishIntent, explanation, category, isFluencySuggestion, sourceType } = req.body;

    if (!frenchAttempt) {
      return res.status(400).json({ error: 'frenchAttempt is required' });
    }

    const prompt = EXTRACTION_PROMPT
      .replace('{frenchAttempt}', frenchAttempt)
      .replace('{englishIntent}', englishIntent || '')
      .replace('{explanation}', explanation || '')
      .replace('{category}', category || 'grammar')
      .replace('{sourceType}', sourceType || 'speech')
      .replace('{isFluencySuggestion}', isFluencySuggestion ? 'true' : 'false');

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { 
          role: 'system', 
          content: 'You are a French language teaching expert. Generate diverse practice questions using DIFFERENT sentence contexts for each question. Never repeat the same phrase. Always respond with valid JSON.' 
        },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' },
      max_tokens: 2000,
      temperature: 0.8,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return res.status(500).json({ error: 'No content in AI response' });
    }

    const result = JSON.parse(content);
    res.json(result);
  } catch (error) {
    console.error('Error extracting concept:', error);
    res.status(500).json({ error: error.message || 'Failed to extract concept' });
  }
});

const CONVERSATION_PROMPT = `You are a French content generator for language learning.

Generate natural French audio content based on the type specified.

TYPES:
1. DIALOGUE: A conversation between two speakers (A and B)
2. STORY: A narrative told by a single narrator

REQUIREMENTS:
- Match the target duration (approximate word count: 30s = ~50 words, 1min = ~100 words, 2min = ~200 words, 4min = ~400 words)
- Use natural, everyday French appropriate for the difficulty level
- Include common phrases and expressions native speakers use
- For dialogues: Make exchanges flow naturally with questions and responses
- For stories: Create engaging narratives with clear progression
- Each turn should be 1-3 sentences

DIFFICULTY LEVELS:
- beginner: Simple vocabulary, present tense, short sentences, common words
- intermediate: Mixed tenses, common expressions, varied vocabulary
- advanced: Complex grammar, idiomatic expressions, nuanced language, literary style

RESPONSE FORMAT (JSON):
{
  "topic": "Topic/Title",
  "difficulty": "difficulty level",
  "turns": [
    { "speaker": "A", "text": "French text here" },
    { "speaker": "B", "text": "French response here" }
  ],
  "fullText": "All text combined for reference"
}

For stories, use speaker "A" for all turns (single narrator).`;

app.post('/api/generate-conversation', async (req, res) => {
  try {
    const { topic, description, difficulty, type, targetDuration } = req.body;

    const typeInstruction = type === 'story' 
      ? 'Generate a SHORT STORY (narrative) with a single narrator. Split into multiple turns for pacing.'
      : 'Generate a DIALOGUE between two speakers (A and B).';
    
    const durationInstruction = targetDuration 
      ? `Target duration: approximately ${targetDuration} minutes (~${Math.round(targetDuration * 100)} words)`
      : 'Target duration: 1-2 minutes';

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: CONVERSATION_PROMPT },
        { role: 'user', content: `${typeInstruction}

Title: ${topic}
Description: ${description || topic}
Difficulty: ${difficulty}
${durationInstruction}

Create engaging, natural French content that matches the title and description.` }
      ],
      response_format: { type: 'json_object' },
      max_tokens: 2000,
      temperature: 0.9,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return res.status(500).json({ error: 'No content in AI response' });
    }

    const result = JSON.parse(content);
    
    const turnsWithTiming = result.turns.map((turn, _index) => ({
      ...turn,
      startTime: 0,
      endTime: 0,
    }));

    res.json({
      ...result,
      turns: turnsWithTiming,
    });
  } catch (error) {
    console.error('Error generating conversation:', error);
    res.status(500).json({ error: error.message || 'Failed to generate conversation' });
  }
});

app.post('/api/translate', async (req, res) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { 
          role: 'system', 
          content: 'You are a French to English translator. Translate the given French text to natural, fluent English. Respond with only the translation, no explanations.' 
        },
        { role: 'user', content: text }
      ],
      max_tokens: 500,
      temperature: 0.3,
    });

    const translation = response.choices[0]?.message?.content?.trim();
    res.json({ translation });
  } catch (error) {
    console.error('Translation error:', error);
    res.status(500).json({ error: error.message || 'Translation failed' });
  }
});

app.post('/api/text-to-speech', async (req, res) => {
  try {
    const { text, voiceId } = req.body;
    const apiKey = process.env.EXPO_PUBLIC_ELEVENLABS_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: 'ElevenLabs API key not configured' });
    }

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`ElevenLabs API error: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    res.set('Content-Type', 'audio/mpeg');
    res.send(buffer);
  } catch (error) {
    console.error('TTS error:', error);
    res.status(500).json({ error: error.message || 'TTS failed' });
  }
});

app.post('/api/translate', async (req, res) => {
  try {
    const { text, sourceLanguage, targetLanguage } = req.body;
    
    if (!text || !sourceLanguage || !targetLanguage) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const sourceLangName = sourceLanguage === 'en' ? 'English' : 'French';
    const targetLangName = targetLanguage === 'en' ? 'English' : 'French';

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a professional translator. Translate the following text from ${sourceLangName} to ${targetLangName}. Provide only the translation, no explanations or additional text. Maintain the original tone and style.`,
        },
        {
          role: 'user',
          content: text,
        },
      ],
      max_tokens: 500,
      temperature: 0.3,
    });

    const translation = response.choices[0]?.message?.content || '';
    res.json({ translation });
  } catch (error) {
    console.error('Translation error:', error);
    res.status(500).json({ error: error.message || 'Translation failed' });
  }
});

app.post('/api/tense-practice', async (req, res) => {
  try {
    const { tense, tenseFrenchName, count = 10 } = req.body;
    
    if (!tense || !tenseFrenchName) {
      return res.status(400).json({ error: 'Missing tense information' });
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a French language teacher creating practice questions for the ${tense} (${tenseFrenchName}) tense.

Generate ${count} practice questions in JSON format. Use a variety of French verbs (not just common ones like être, avoir, aller - include verbs like regarder, attendre, comprendre, répondre, choisir, dormir, vivre, etc.).

For each question, create ONE of these types:
1. "conjugate": Given a verb and pronoun, conjugate it in ${tense}. Example: "Conjugate 'parler' for 'nous' in ${tense}."
2. "fill_blank": Complete the sentence with the correct verb form. Example: "Elle ______ (manger) une pomme."
3. "translate": Translate an English sentence using ${tense}. Example: "Translate: 'We will eat tomorrow.'"
4. "identify": Identify the correct ${tense} form among 4 options. Always provide exactly 4 choices.
5. "correct": IMPORTANT - The sentence MUST contain an INCORRECT conjugation that needs fixing. Use a wrong form like using the wrong pronoun's ending or mixing up tenses. Example for ${tense}: "Fix the error: 'Je parlons français.'" where the answer is "Je parle français." NEVER give a sentence that is already correct.

CRITICAL RULES:
- For "correct" type: The sentence in the question MUST be grammatically WRONG. Do not ask to fix something that is already correct.
- For "identify" type: Always provide exactly 4 options in the "options" array.

Return JSON object with "questions" array:
{
  "questions": [
    {
      "type": "conjugate|fill_blank|translate|identify|correct",
      "question": "The question text",
      "verb": "infinitive form (if applicable)",
      "correctAnswer": "The correct answer (for correct type, this is the fixed sentence)",
      "options": ["4 choices for identify type, null for others"],
      "explanation": "Brief explanation in English"
    }
  ]
}

Mix question types. Vary difficulty. Use everyday situations.`,
        },
        {
          role: 'user',
          content: `Generate ${count} practice questions for ${tense} (${tenseFrenchName}).`,
        },
      ],
      max_tokens: 2000,
      temperature: 0.8,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content || '{"questions":[]}';
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = { questions: [] };
    }
    
    const questions = parsed.questions || parsed || [];
    res.json({ questions: Array.isArray(questions) ? questions : [] });
  } catch (error) {
    console.error('Tense practice error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate questions' });
  }
});

app.post('/api/pronunciation-assessment', upload.single('audio'), async (req, res) => {
  const AZURE_SPEECH_KEY = (process.env.AZURE_SPEECH_KEY || process.env.EXPO_PUBLIC_AZURE_SPEECH_KEY || '').trim();
  const AZURE_SPEECH_REGION = (process.env.AZURE_SPEECH_REGION || process.env.EXPO_PUBLIC_AZURE_SPEECH_REGION || '').trim();

  if (!AZURE_SPEECH_KEY || !AZURE_SPEECH_REGION) {
    console.error('[PronAssess] Missing credentials - key:', !!AZURE_SPEECH_KEY, 'region:', !!AZURE_SPEECH_REGION);
    return res.status(500).json({ error: 'Azure Speech credentials not configured' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'No audio file provided' });
  }

  const referenceText = req.body.referenceText;
  const language = req.body.language || 'fr-FR';
  const _targetPhonemes = req.body.targetPhonemes ? JSON.parse(req.body.targetPhonemes) : [];

  if (!referenceText) {
    return res.status(400).json({ error: 'Reference text is required' });
  }

  console.log('[PronAssess] Request - language:', language, 'ref:', referenceText, 'audioSize:', req.file.buffer.length, 'mime:', req.file.mimetype);

  const tempDir = os.tmpdir();
  const timestamp = Date.now();
  let audioData;
  let tempFiles = [];

  try {
    const buf = req.file.buffer;
    const isWav = buf.length > 44 &&
      buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
      buf[8] === 0x57 && buf[9] === 0x41 && buf[10] === 0x56 && buf[11] === 0x45;

    if (isWav) {
      console.log('[PronAssess] Audio is already WAV, skipping conversion');
      audioData = buf;
    } else {
      console.log('[PronAssess] Audio is not WAV, attempting ffmpeg conversion');
      const inputExt = req.file.mimetype?.includes('ogg') ? '.ogg' : '.webm';
      const inputPath = path.join(tempDir, `pron_in_${timestamp}${inputExt}`);
      const wavPath = path.join(tempDir, `pron_out_${timestamp}.wav`);
      tempFiles.push(inputPath, wavPath);

      fs.writeFileSync(inputPath, buf);

      await new Promise((resolve, reject) => {
        exec(`ffmpeg -y -i "${inputPath}" -ar 16000 -ac 1 -sample_fmt s16 "${wavPath}"`, (error, stdout, stderr) => {
          if (error) {
            console.error('[PronAssess] FFmpeg error:', stderr);
            reject(new Error('Audio conversion failed. FFmpeg may not be available.'));
          } else {
            resolve();
          }
        });
      });

      audioData = fs.readFileSync(wavPath);
    }

    console.log('[PronAssess] WAV data size:', audioData.length, 'bytes');

    const speechConfig = sdk.SpeechConfig.fromSubscription(AZURE_SPEECH_KEY, AZURE_SPEECH_REGION);
    speechConfig.speechRecognitionLanguage = language;

    const pronunciationConfig = new sdk.PronunciationAssessmentConfig(
      referenceText,
      sdk.PronunciationAssessmentGradingSystem.HundredMark,
      sdk.PronunciationAssessmentGranularity.Phoneme,
      true
    );
    pronunciationConfig.phonemeAlphabet = 'IPA';
    pronunciationConfig.nbestPhonemeCount = 5;

    const wavHeaderSize = 44;
    const pcmData = audioData.length > wavHeaderSize ? audioData.slice(wavHeaderSize) : audioData;

    const pushStream = sdk.AudioInputStream.createPushStream(
      sdk.AudioStreamFormat.getWaveFormatPCM(16000, 16, 1)
    );
    pushStream.write(pcmData);
    pushStream.close();

    const audioConfig = sdk.AudioConfig.fromStreamInput(pushStream);
    const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);
    pronunciationConfig.applyTo(recognizer);

    const result = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        recognizer.close();
        reject(new Error('Recognition timed out after 15 seconds'));
      }, 15000);
      recognizer.recognizeOnceAsync(
        (result) => {
          clearTimeout(timeout);
          recognizer.close();
          resolve(result);
        },
        (error) => {
          clearTimeout(timeout);
          recognizer.close();
          reject(error);
        }
      );
    });

    for (const f of tempFiles) { try { fs.unlinkSync(f); } catch {} }

    console.log('[PronAssess] Recognition reason:', result.reason);

    if (result.reason === sdk.ResultReason.RecognizedSpeech) {
      const pronunciationResult = sdk.PronunciationAssessmentResult.fromResult(result);

      const words = [];
      const phonemes = [];
      if (pronunciationResult.detailResult && pronunciationResult.detailResult.Words) {
        for (const word of pronunciationResult.detailResult.Words) {
          const wordPhonemes = [];
          if (word.Phonemes) {
            for (const phoneme of word.Phonemes) {
              const pData = {
                phoneme: phoneme.Phoneme,
                accuracyScore: phoneme.PronunciationAssessment?.AccuracyScore || 0,
                nBestPhonemes: (phoneme.PronunciationAssessment?.NBestPhonemes || []).map(nb => ({
                  phoneme: nb.Phoneme,
                  score: nb.Score,
                })),
              };
              wordPhonemes.push(pData);
              phonemes.push(pData);
            }
          }
          words.push({
            word: word.Word,
            accuracyScore: word.PronunciationAssessment?.AccuracyScore || 0,
            errorType: word.PronunciationAssessment?.ErrorType || 'None',
            phonemes: wordPhonemes,
          });
        }
      }

      let feedback = '';
      const accuracyScore = pronunciationResult.accuracyScore || 0;

      if (accuracyScore >= 90) {
        feedback = 'Excellent pronunciation! Your French sounds very natural.';
      } else if (accuracyScore >= 80) {
        feedback = 'Great job! Minor improvements could make it perfect.';
      } else if (accuracyScore >= 70) {
        feedback = 'Good attempt! Focus on the target sounds and try again.';
      } else if (accuracyScore >= 50) {
        feedback = 'Keep practicing! Listen to the correct pronunciation and pay attention to mouth position.';
      } else {
        feedback = 'Try listening to the correct pronunciation first, then speak more slowly and clearly.';
      }

      const lowScorePhonemes = phonemes.filter(p => p.accuracyScore < 70);
      if (lowScorePhonemes.length > 0) {
        const problemSounds = [...new Set(lowScorePhonemes.map(p => p.phoneme))].slice(0, 3);
        feedback += ` Pay special attention to: ${problemSounds.join(', ')}.`;
      }

      console.log('[PronAssess] Success - accuracy:', accuracyScore, 'words:', words.length);

      res.json({
        accuracyScore: pronunciationResult.accuracyScore || 0,
        pronunciationScore: pronunciationResult.pronunciationScore || 0,
        completenessScore: pronunciationResult.completenessScore || 0,
        fluencyScore: pronunciationResult.fluencyScore || 0,
        recognizedText: result.text || '',
        words,
        phonemes,
        feedback,
      });
    } else if (result.reason === sdk.ResultReason.NoMatch) {
      console.log('[PronAssess] NoMatch - no speech recognized');
      res.json({
        accuracyScore: 0,
        pronunciationScore: 0,
        completenessScore: 0,
        fluencyScore: 0,
        recognizedText: '',
        words: [],
        phonemes: [],
        feedback: 'Could not recognize speech. Please speak more clearly and try again.',
      });
    } else {
      console.error('[PronAssess] Unexpected result reason:', result.reason);
      res.status(500).json({
        error: 'Speech recognition failed. Please try again.',
      });
    }
  } catch (error) {
    const errMsg = error?.message || (typeof error === 'string' ? error : JSON.stringify(error));
    const errName = error?.name || 'UnknownError';
    const errStack = error?.stack?.split('\n').slice(0, 3).join(' | ') || '';
    console.error('[PronAssess] Error [' + errName + ']:', errMsg);
    console.error('[PronAssess] Stack:', errStack);
    for (const f of tempFiles) { try { fs.unlinkSync(f); } catch {} }
    res.status(500).json({ error: '[' + errName + '] ' + errMsg });
  }
});



app.post('/api/dub-segment', async (req, res) => {
  try {
    const {
      videoId,
      segmentIndex,
      frenchText,
      voiceId = DUB_DEFAULT_VOICE_ID,
      speed = 1.0,
    } = req.body;

    if (!videoId || segmentIndex === undefined || !frenchText) {
      return res.status(400).json({ error: 'videoId, segmentIndex, and frenchText are required' });
    }

    const cacheKey = `${videoId}_${segmentIndex}_${voiceId}`;

    if (dubCache.has(cacheKey)) {
      console.log('[DubSegment] Cache hit:', cacheKey);
      return res.json({ audio: dubCache.get(cacheKey), cached: true });
    }

    if (!checkDubRateLimit()) {
      console.warn('[DubSegment] Rate limited');
      return res.status(429).json({ error: 'Rate limit exceeded. Max 10 requests per second.' });
    }

    const apiKey = process.env.ELEVENLABS_API_KEY || process.env.EXPO_PUBLIC_ELEVENLABS_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'ElevenLabs API key not configured' });
    }

    console.log('[DubSegment] Generating TTS for:', cacheKey, 'text:', frenchText.substring(0, 60));

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
      },
      body: JSON.stringify({
        text: frenchText,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.6,
          similarity_boost: 0.75,
          speed: speed,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error('[DubSegment] ElevenLabs error:', response.status, errorText);
      return res.status(502).json({ error: `ElevenLabs API error: ${response.status}` });
    }

    const arrayBuffer = await response.arrayBuffer();
    const base64Audio = Buffer.from(arrayBuffer).toString('base64');

    dubCache.set(cacheKey, base64Audio);
    console.log('[DubSegment] Generated and cached:', cacheKey, 'size:', base64Audio.length);

    res.json({ audio: base64Audio, cached: false });
  } catch (error) {
    console.error('[DubSegment] Error:', error.message || error);
    res.status(500).json({ error: error.message || 'Failed to generate dub segment' });
  }
});

// ========== Static File Serving ==========

const distDir = path.resolve(__dirname, '../dist');
const distIndexPath = path.join(distDir, 'index.html');
const hasDistIndex = fs.existsSync(distIndexPath);

console.log('[Server] Static config:', JSON.stringify({
  distDir,
  hasDistIndex,
}));

app.use(express.static(distDir, {
  index: ['index.html'],
  fallthrough: true,
}));

app.use((req, res, next) => {
  const isSpaRequest = (req.method === 'GET' || req.method === 'HEAD') && !req.path.startsWith('/api/');

  if (!isSpaRequest) {
    next();
    return;
  }

  const requestedPath = path.resolve(distDir, `.${req.path}`);
  const canServeRequestedFile = requestedPath.startsWith(distDir)
    && fs.existsSync(requestedPath)
    && fs.statSync(requestedPath).isFile();

  if (canServeRequestedFile) {
    console.log('[Server] Serving static file:', req.path);
    res.sendFile(requestedPath);
    return;
  }

  if (hasDistIndex) {
    console.log('[Server] Serving SPA fallback:', req.path);
    res.sendFile(distIndexPath);
    return;
  }

  console.error('[Server] Missing web build for request:', req.path);
  res.status(503).json({ error: 'Web build is unavailable' });
});

const parsedPort = Number(requestedPort || process.env.PORT || 5000);
const PORT = Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : 5000;
const HOST = requestedHost || '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`[Server] Listening on http://${HOST}:${PORT}`);
});
