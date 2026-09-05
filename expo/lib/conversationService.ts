import { supabase } from '@/lib/supabase';
import { generateText } from '@rork-ai/toolkit-sdk';
import {
  ConversationSession,
  ConversationMessage,
  CEFRLevel,
} from '@/types';
import { conversationScenarios } from '@/data/conversationScenarios';

function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function startSession(
  scenarioId: string,
  targetLanguage: string,
  cefrLevel: CEFRLevel
): Promise<ConversationSession> {
  const sessionId = generateId();
  const now = new Date().toISOString();

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id || 'anonymous';

  const session: ConversationSession = {
    id: sessionId,
    userId,
    scenarioId,
    targetLanguage,
    cefrLevelAtStart: cefrLevel,
    durationSeconds: 0,
    totalMessages: 0,
    pronunciationScoreAvg: 0,
    grammarScoreAvg: 0,
    fluencyScoreAvg: 0,
    overallScore: 0,
    newVocabularyCount: 0,
    status: 'active',
    createdAt: now,
    messages: [],
  };

  console.log('[ConversationService] Starting session:', sessionId, 'scenario:', scenarioId);

  const { error } = await supabase
    .from('conversation_sessions')
    .insert({
      id: session.id,
      user_id: session.userId,
      scenario_id: session.scenarioId,
      target_language: session.targetLanguage,
      cefr_level_at_start: session.cefrLevelAtStart,
      duration_seconds: 0,
      total_messages: 0,
      pronunciation_score_avg: 0,
      grammar_score_avg: 0,
      fluency_score_avg: 0,
      overall_score: 0,
      new_vocabulary_count: 0,
      status: 'active',
      created_at: now,
    });

  if (error) {
    console.log('[ConversationService] Error inserting session (may not exist yet):', error.message);
  }

  return session;
}

export interface StreamCallbacks {
  onToken?: (token: string) => void;
  onComplete?: (fullText: string) => void;
  onError?: (error: Error) => void;
}

function buildSystemPrompt(
  cefrLevel: CEFRLevel,
  targetLanguage: string,
  scenarioId: string,
): string {
  const scenario = conversationScenarios.find((s) => s.id === scenarioId);
  const scenarioTitle = scenario?.title || 'Free Conversation';
  const scenarioDesc = scenario?.description || 'Open conversation on any topic.';

  const langName = targetLanguage === 'fr' ? 'French' : targetLanguage;

  return `You are Kiri, a friendly and encouraging ${langName} language tutor having a real-time voice conversation with a student.

Scenario: "${scenarioTitle}" — ${scenarioDesc}
Student's CEFR level: ${cefrLevel}

Rules:
- Speak primarily in ${langName}, adapting complexity to the student's ${cefrLevel} level.
- Keep your spoken responses concise — 1 to 3 sentences maximum. This is a real-time voice conversation, not an essay. Respond naturally and briefly.
- Stay in character for the scenario. If the scenario is "At a Café", act as a barista/waiter. If "Free Conversation", chat naturally about any topic.
- Gently correct grammar mistakes by naturally rephrasing what the student said correctly, without being preachy.
- Introduce 1-2 new vocabulary words per exchange when natural, using context clues.
- If the student seems stuck, offer a gentle prompt or simpler phrasing.
- Never break character to explain grammar rules in English unless the student explicitly asks.
- Be warm, patient, and conversational — like a real friend helping them practice.

After your spoken response, include a <feedback> JSON block with corrections and new vocabulary:
<feedback>{"corrections":[{"original":"student's error","corrected":"correct form","rule":"brief rule name"}],"newVocabulary":[{"word":"french word","translation":"english translation","level":"${cefrLevel}"}]}</feedback>

If there are no corrections or new vocabulary, use empty arrays. The feedback block must be valid JSON.`;
}

export async function sendMessage(
  sessionId: string,
  transcript: string,
  conversationHistory: ConversationMessage[],
  cefrLevel: CEFRLevel,
  targetLanguage: string,
  scenarioId: string,
  callbacks?: StreamCallbacks
): Promise<ConversationMessage | null> {
  console.log('[ConversationService] Sending message via Gemini for session:', sessionId);

  const userMessage: ConversationMessage = {
    id: generateId(),
    sessionId,
    role: 'user',
    textContent: transcript,
    sequenceNumber: conversationHistory.length,
    createdAt: new Date().toISOString(),
  };

  const { error: userMsgError } = await supabase
    .from('conversation_messages')
    .insert({
      id: userMessage.id,
      session_id: userMessage.sessionId,
      role: userMessage.role,
      text_content: userMessage.textContent,
      sequence_number: userMessage.sequenceNumber,
      created_at: userMessage.createdAt,
    });

  if (userMsgError) {
    console.log('[ConversationService] Error saving user message:', userMsgError.message);
  }

  try {
    const systemPrompt = buildSystemPrompt(cefrLevel, targetLanguage, scenarioId);

    type GeminiMessage = { role: 'user' | 'assistant'; content: string };
    const messages: GeminiMessage[] = [
      { role: 'user', content: systemPrompt },
      { role: 'assistant', content: 'Understood. I will follow these instructions for our conversation.' },
    ];

    for (const msg of conversationHistory) {
      messages.push({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.textContent,
      });
    }

    messages.push({ role: 'user', content: transcript });

    console.log('[ConversationService] Calling generateText with', messages.length, 'messages');

    const fullText = await generateText({ messages });

    console.log('[ConversationService] Gemini response received, length:', fullText.length);

    callbacks?.onToken?.(fullText);

    let feedbackData: {
      grammarErrors?: ConversationMessage['grammarErrors'];
      vocabularyHighlights?: ConversationMessage['vocabularyHighlights'];
      fluencyMetrics?: ConversationMessage['fluencyMetrics'];
      pronunciationScore?: number;
    } = {};

    let cleanedText = fullText;
    const feedbackMatch = fullText.match(/<feedback>(.*?)<\/feedback>/s);
    if (feedbackMatch) {
      cleanedText = fullText.replace(/<feedback>.*?<\/feedback>/s, '').trim();
      try {
        const fb = JSON.parse(feedbackMatch[1]);
        if (fb.corrections) {
          feedbackData.grammarErrors = fb.corrections.map((c: { original: string; corrected: string; rule: string }) => ({
            original: c.original,
            corrected: c.corrected,
            rule: c.rule,
          }));
        }
        if (fb.newVocabulary) {
          feedbackData.vocabularyHighlights = fb.newVocabulary.map((v: { word: string; translation: string; level: string }) => ({
            word: v.word,
            translation: v.translation,
            isNew: true,
          }));
        }
      } catch (fbErr) {
        console.log('[ConversationService] Failed to parse feedback block:', fbErr);
      }
    }

    const assistantMessage: ConversationMessage = {
      id: generateId(),
      sessionId,
      role: 'assistant',
      textContent: cleanedText || fullText,
      grammarErrors: feedbackData.grammarErrors,
      vocabularyHighlights: feedbackData.vocabularyHighlights,
      fluencyMetrics: feedbackData.fluencyMetrics,
      pronunciationScore: feedbackData.pronunciationScore,
      sequenceNumber: conversationHistory.length + 1,
      createdAt: new Date().toISOString(),
    };

    const { error: assistantMsgError } = await supabase
      .from('conversation_messages')
      .insert({
        id: assistantMessage.id,
        session_id: assistantMessage.sessionId,
        role: assistantMessage.role,
        text_content: assistantMessage.textContent,
        pronunciation_score: assistantMessage.pronunciationScore,
        grammar_errors: assistantMessage.grammarErrors,
        vocabulary_highlights: assistantMessage.vocabularyHighlights,
        fluency_metrics: assistantMessage.fluencyMetrics,
        sequence_number: assistantMessage.sequenceNumber,
        created_at: assistantMessage.createdAt,
      });

    if (assistantMsgError) {
      console.log('[ConversationService] Error saving assistant message:', assistantMsgError.message);
    }

    callbacks?.onComplete?.(assistantMessage.textContent);

    return assistantMessage;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.log('[ConversationService] sendMessage error:', err.message);
    callbacks?.onError?.(err);
    return null;
  }
}

export interface GeminiMessageResponse {
  text: string;
  userTranscript: string;
  audio?: string;
}

const GEMINI_ENDPOINT = 'https://ubclvjqvddglcsvgxlaz.supabase.co/functions/v1/gemini-converse';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

export async function sendGeminiMessage(params: {
  sessionId: string;
  audioData?: string;
  audioMimeType?: string;
  userMessage?: string;
  conversationHistory: { role: string; content: string }[];
  scenarioId: string;
  scenarioTitle: string;
  targetLanguage: string;
  cefrLevel: CEFRLevel;
}): Promise<GeminiMessageResponse> {
  console.log('[GeminiService] Sending to Gemini...', {
    hasAudio: !!params.audioData,
    audioLength: params.audioData?.length || 0,
    hasText: !!params.userMessage,
    historyLength: params.conversationHistory.length,
    scenario: params.scenarioId,
  });

  const response = await fetch(GEMINI_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      audioData: params.audioData,
      audioMimeType: params.audioMimeType || 'audio/wav',
      userMessage: params.userMessage,
      conversationHistory: params.conversationHistory,
      scenarioId: params.scenarioId,
      scenarioTitle: params.scenarioTitle,
      targetLanguage: params.targetLanguage,
      cefrLevel: params.cefrLevel,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'unknown');
    console.log('[GeminiService] Error:', response.status, errorText);
    throw new Error(`Gemini error ${response.status}: ${errorText}`);
  }

  const result = await response.json();
  console.log('[GeminiService] Response received:', {
    textLength: result.text?.length || 0,
    userTranscript: result.userTranscript?.substring(0, 80),
  });

  console.log('[GeminiService] Audio in response:', result.audio ? `yes (${result.audio.length} chars)` : 'no');

  return {
    text: result.text || '',
    userTranscript: result.userTranscript || '',
    audio: result.audio || undefined,
  };
}

export async function endSession(sessionId: string): Promise<void> {
  console.log('[ConversationService] Ending session:', sessionId);

  const now = new Date().toISOString();

  const { error } = await supabase
    .from('conversation_sessions')
    .update({
      status: 'completed',
      ended_at: now,
    })
    .eq('id', sessionId);

  if (error) {
    console.log('[ConversationService] Error ending session:', error.message);
  }
}

export async function getSessionHistory(
  userId: string
): Promise<ConversationSession[]> {
  console.log('[ConversationService] Fetching session history for user:', userId);

  const { data: sessions, error } = await supabase
    .from('conversation_sessions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.log('[ConversationService] Error fetching sessions:', error.message);
    return [];
  }

  if (!sessions || sessions.length === 0) {
    return [];
  }

  const sessionIds = sessions.map((s: Record<string, unknown>) => s.id as string);

  const { data: messages, error: msgError } = await supabase
    .from('conversation_messages')
    .select('*')
    .in('session_id', sessionIds)
    .order('sequence_number', { ascending: true });

  if (msgError) {
    console.log('[ConversationService] Error fetching messages:', msgError.message);
  }

  const messagesBySession: Record<string, ConversationMessage[]> = {};
  if (messages) {
    for (const msg of messages) {
      const mapped: ConversationMessage = {
        id: msg.id,
        sessionId: msg.session_id,
        role: msg.role,
        textContent: msg.text_content,
        audioUrl: msg.audio_url,
        pronunciationScore: msg.pronunciation_score,
        grammarErrors: msg.grammar_errors,
        vocabularyHighlights: msg.vocabulary_highlights,
        fluencyMetrics: msg.fluency_metrics,
        sequenceNumber: msg.sequence_number,
        createdAt: msg.created_at,
      };
      if (!messagesBySession[mapped.sessionId]) {
        messagesBySession[mapped.sessionId] = [];
      }
      messagesBySession[mapped.sessionId].push(mapped);
    }
  }

  return sessions.map((s: Record<string, unknown>) => ({
    id: s.id as string,
    userId: s.user_id as string,
    scenarioId: s.scenario_id as string,
    targetLanguage: s.target_language as string,
    cefrLevelAtStart: s.cefr_level_at_start as CEFRLevel,
    durationSeconds: (s.duration_seconds as number) || 0,
    totalMessages: (s.total_messages as number) || 0,
    pronunciationScoreAvg: (s.pronunciation_score_avg as number) || 0,
    grammarScoreAvg: (s.grammar_score_avg as number) || 0,
    fluencyScoreAvg: (s.fluency_score_avg as number) || 0,
    overallScore: (s.overall_score as number) || 0,
    newVocabularyCount: (s.new_vocabulary_count as number) || 0,
    status: s.status as ConversationSession['status'],
    createdAt: s.created_at as string,
    endedAt: s.ended_at as string | undefined,
    messages: messagesBySession[s.id as string] || [],
  }));
}