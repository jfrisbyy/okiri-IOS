import { useState, useRef, useCallback } from 'react';
import {
  ConversationMessage,
  ConversationSession,
  CEFRLevel,
} from '@/types';
import * as conversationService from '@/lib/conversationService';
import { supabase } from '@/lib/supabase';
import { conversationScenarios } from '@/data/conversationScenarios';

function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export function useConversation() {
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [currentSession, setCurrentSession] = useState<ConversationSession | null>(null);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isAiSpeaking, setIsAiSpeaking] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [partialTranscript, setPartialTranscript] = useState<string>('');
  const [lastAiAudioBase64, setLastAiAudioBase64] = useState<string | null>(null);

  const sessionStartTimeRef = useRef<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  const startConversation = useCallback(async (
    scenarioId: string,
    targetLanguage: string = 'fr',
    cefrLevel: CEFRLevel = 'A2'
  ) => {
    console.log('[useConversation] Starting conversation, scenario:', scenarioId);

    try {
      const session = await conversationService.startSession(scenarioId, targetLanguage, cefrLevel);
      setCurrentSession(session);
      setMessages([]);
      setIsProcessing(false);
      setIsRecording(false);
      setIsAiSpeaking(false);
      setPartialTranscript('');
      sessionStartTimeRef.current = Date.now();

      const scenario = conversationScenarios.find((s) => s.id === scenarioId);
      const scenarioTitle = scenario?.title || 'Free Conversation';

      console.log('[useConversation] Session created:', session.id, '— requesting opening message');

      setIsProcessing(true);

      try {
        console.log('[useConversation] Requesting opening message via Gemini');

        const geminiResult = await conversationService.sendGeminiMessage({
          sessionId: session.id,
          userMessage: `[SYSTEM] The user has started a "${scenarioTitle}" conversation. Greet them in French and set the scene. Keep it to 1-2 sentences appropriate for ${cefrLevel} level.`,
          conversationHistory: [],
          scenarioId,
          scenarioTitle,
          targetLanguage,
          cefrLevel,
        });

        let cleanedText = geminiResult.text;
        const feedbackMatch = geminiResult.text.match(/<feedback>(.*?)<\/feedback>/s);
        if (feedbackMatch) {
          cleanedText = geminiResult.text.replace(/<feedback>.*?<\/feedback>/s, '').trim();
        }

        const aiMessage: ConversationMessage = {
          id: generateId(),
          sessionId: session.id,
          role: 'assistant',
          textContent: cleanedText || geminiResult.text,
          sequenceNumber: 0,
          createdAt: new Date().toISOString(),
        };

        console.log('[useConversation] Opening message received via Gemini, length:', aiMessage.textContent.length);
        if (geminiResult.audio) {
          console.log('[useConversation] Opening message has Gemini audio, length:', geminiResult.audio.length);
          setLastAiAudioBase64(geminiResult.audio);
        } else {
          console.log('[useConversation] Opening message has NO Gemini audio, will fall back to TTS');
          setLastAiAudioBase64(null);
        }
        setMessages([aiMessage]);
        setIsProcessing(false);
        setIsAiSpeaking(true);
      } catch (error) {
        console.log('[useConversation] Opening message Gemini error:', error);
        const fallbackMessage: ConversationMessage = {
          id: generateId(),
          sessionId: session.id,
          role: 'assistant',
          textContent: 'Bonjour ! Comment puis-je vous aider aujourd\'hui ?',
          sequenceNumber: 0,
          createdAt: new Date().toISOString(),
        };
        setLastAiAudioBase64(null);
        setMessages([fallbackMessage]);
        setIsProcessing(false);
        setIsAiSpeaking(true);
      }

      return session;
    } catch (error) {
      console.log('[useConversation] startConversation error:', error);
      setIsProcessing(false);
      throw error;
    }
  }, []);

  const sendUserMessageInner = useCallback(async (transcript: string) => {
    if (!currentSession) {
      console.log('[useConversation] No active session, cannot send message');
      return;
    }

    if (!transcript.trim()) {
      console.log('[useConversation] Empty transcript, skipping');
      return;
    }

    console.log('[useConversation] Sending user message:', transcript.substring(0, 50));

    const userMessage: ConversationMessage = {
      id: generateId(),
      sessionId: currentSession.id,
      role: 'user',
      textContent: transcript.trim(),
      sequenceNumber: messages.length,
      createdAt: new Date().toISOString(),
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setPartialTranscript('');
    setIsRecording(false);
    setIsProcessing(true);

    const aiMessageId = generateId();

    const aiPlaceholder: ConversationMessage = {
      id: aiMessageId,
      sessionId: currentSession.id,
      role: 'assistant',
      textContent: '',
      sequenceNumber: messages.length + 1,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, aiPlaceholder]);

    try {
      const history = updatedMessages.map(m => ({ role: m.role, content: m.textContent }));
      const scenario = conversationScenarios.find(s => s.id === currentSession.scenarioId);

      console.log('[useConversation] Sending text message via Gemini');

      const geminiResult = await conversationService.sendGeminiMessage({
        sessionId: currentSession.id,
        userMessage: transcript.trim(),
        conversationHistory: history,
        scenarioId: currentSession.scenarioId,
        scenarioTitle: scenario?.title || currentSession.scenarioId,
        targetLanguage: currentSession.targetLanguage,
        cefrLevel: currentSession.cefrLevelAtStart,
      });

      let cleanedText = geminiResult.text;
      let feedbackData: {
        grammarErrors?: ConversationMessage['grammarErrors'];
        vocabularyHighlights?: ConversationMessage['vocabularyHighlights'];
        pronunciationScore?: number;
      } = {};

      const feedbackMatch = geminiResult.text.match(/<feedback>(.*?)<\/feedback>/s);
      if (feedbackMatch) {
        cleanedText = geminiResult.text.replace(/<feedback>.*?<\/feedback>/s, '').trim();
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
            feedbackData.vocabularyHighlights = fb.newVocabulary.map((v: { word: string; translation: string }) => ({
              word: v.word,
              translation: v.translation,
              isNew: true,
            }));
          }
        } catch (fbErr) {
          console.log('[useConversation] Failed to parse Gemini feedback:', fbErr);
        }
      }

      console.log('[useConversation] Gemini text response received, length:', cleanedText.length);

      if (geminiResult.audio) {
        console.log('[useConversation] Response has Gemini audio, length:', geminiResult.audio.length);
        setLastAiAudioBase64(geminiResult.audio);
      } else {
        console.log('[useConversation] Response has NO Gemini audio, will fall back to TTS');
        setLastAiAudioBase64(null);
      }

      setMessages((prev) => {
        const updated = [...prev];
        const idx = updated.findIndex((m) => m.id === aiMessageId);
        if (idx !== -1) {
          updated[idx] = {
            ...updated[idx],
            textContent: cleanedText || geminiResult.text,
            grammarErrors: feedbackData.grammarErrors,
            vocabularyHighlights: feedbackData.vocabularyHighlights,
            pronunciationScore: feedbackData.pronunciationScore,
          };
        }
        return updated;
      });

      setIsProcessing(false);
      setIsAiSpeaking(true);
    } catch (error) {
      console.log('[useConversation] sendUserMessage Gemini error:', error);
      setMessages((prev) => {
        const updated = [...prev];
        const idx = updated.findIndex((m) => m.id === aiMessageId);
        if (idx !== -1) {
          updated[idx] = {
            ...updated[idx],
            textContent: 'Désolé, je n\'ai pas compris. Pouvez-vous répéter ?',
          };
        }
        return updated;
      });
      setIsProcessing(false);
      setIsAiSpeaking(true);
    }
  }, [currentSession, messages]);

  const sendAudioMessage = useCallback(async (
    audioBase64: string,
    audioMimeType: string,
    fallbackTranscript?: string
  ) => {
    if (!currentSession) {
      console.log('[useConversation] No active session for audio message');
      return;
    }

    console.log('[useConversation] Sending audio to Gemini, audio size:', audioBase64.length, 'fallback:', fallbackTranscript?.substring(0, 30));

    setPartialTranscript('');
    setIsRecording(false);
    setIsProcessing(true);

    try {
      const history = messages.map(m => ({ role: m.role, content: m.textContent }));
      const scenario = conversationScenarios.find(s => s.id === currentSession.scenarioId);

      const geminiResult = await conversationService.sendGeminiMessage({
        sessionId: currentSession.id,
        audioData: audioBase64,
        audioMimeType,
        userMessage: fallbackTranscript,
        conversationHistory: history,
        scenarioId: currentSession.scenarioId,
        scenarioTitle: scenario?.title || 'Free Conversation',
        targetLanguage: currentSession.targetLanguage,
        cefrLevel: currentSession.cefrLevelAtStart,
      });

      const userTranscript = geminiResult.userTranscript || fallbackTranscript || '[audio message]';

      const userMessage: ConversationMessage = {
        id: generateId(),
        sessionId: currentSession.id,
        role: 'user',
        textContent: userTranscript,
        sequenceNumber: messages.length,
        createdAt: new Date().toISOString(),
      };

      let cleanedText = geminiResult.text;
      let feedbackData: {
        grammarErrors?: ConversationMessage['grammarErrors'];
        vocabularyHighlights?: ConversationMessage['vocabularyHighlights'];
        pronunciationScore?: number;
      } = {};

      const feedbackMatch = geminiResult.text.match(/<feedback>(.*?)<\/feedback>/s);
      if (feedbackMatch) {
        cleanedText = geminiResult.text.replace(/<feedback>.*?<\/feedback>/s, '').trim();
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
            feedbackData.vocabularyHighlights = fb.newVocabulary.map((v: { word: string; translation: string }) => ({
              word: v.word,
              translation: v.translation,
              isNew: true,
            }));
          }
        } catch (fbErr) {
          console.log('[useConversation] Failed to parse Gemini feedback:', fbErr);
        }
      }

      const assistantMessage: ConversationMessage = {
        id: generateId(),
        sessionId: currentSession.id,
        role: 'assistant',
        textContent: cleanedText || geminiResult.text,
        grammarErrors: feedbackData.grammarErrors,
        vocabularyHighlights: feedbackData.vocabularyHighlights,
        pronunciationScore: feedbackData.pronunciationScore,
        sequenceNumber: messages.length + 1,
        createdAt: new Date().toISOString(),
      };

      if (geminiResult.audio) {
        console.log('[useConversation] Audio response has Gemini audio, length:', geminiResult.audio.length);
        setLastAiAudioBase64(geminiResult.audio);
      } else {
        console.log('[useConversation] Audio response has NO Gemini audio, will fall back to TTS');
        setLastAiAudioBase64(null);
      }

      setMessages(prev => [...prev, userMessage, assistantMessage]);
      setIsProcessing(false);
      setIsAiSpeaking(true);

      console.log('[useConversation] Gemini audio processed. User said:', userTranscript.substring(0, 60), '| AI:', cleanedText?.substring(0, 60));

      supabase.from('conversation_messages').insert({
        id: userMessage.id,
        session_id: userMessage.sessionId,
        role: userMessage.role,
        text_content: userMessage.textContent,
        sequence_number: userMessage.sequenceNumber,
        created_at: userMessage.createdAt,
      }).then(({ error }) => {
        if (error) console.log('[useConversation] Error saving Gemini user msg:', error.message);
      });

      supabase.from('conversation_messages').insert({
        id: assistantMessage.id,
        session_id: assistantMessage.sessionId,
        role: assistantMessage.role,
        text_content: assistantMessage.textContent,
        pronunciation_score: assistantMessage.pronunciationScore,
        grammar_errors: assistantMessage.grammarErrors,
        vocabulary_highlights: assistantMessage.vocabularyHighlights,
        sequence_number: assistantMessage.sequenceNumber,
        created_at: assistantMessage.createdAt,
      }).then(({ error }) => {
        if (error) console.log('[useConversation] Error saving Gemini assistant msg:', error.message);
      });
    } catch (error) {
      console.log('[useConversation] Gemini audio error:', error);

      if (fallbackTranscript?.trim()) {
        console.log('[useConversation] Falling back to text-based sendUserMessage');
        setIsProcessing(false);
        await sendUserMessageInner(fallbackTranscript);
        return;
      }

      setMessages(prev => [
        ...prev,
        {
          id: generateId(),
          sessionId: currentSession.id,
          role: 'assistant' as const,
          textContent: 'Désolé, je n\'ai pas compris. Pouvez-vous répéter ?',
          sequenceNumber: messages.length,
          createdAt: new Date().toISOString(),
        },
      ]);
      setIsProcessing(false);
      setIsAiSpeaking(true);
    }
  }, [currentSession, messages, sendUserMessageInner]);

  const sendUserMessage = useCallback(async (transcript: string) => {
    await sendUserMessageInner(transcript);
  }, [sendUserMessageInner]);

  const endConversation = useCallback(async () => {
    if (!currentSession) {
      console.log('[useConversation] No session to end');
      return null;
    }

    console.log('[useConversation] Ending conversation:', currentSession.id);

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    const durationSeconds = Math.floor((Date.now() - sessionStartTimeRef.current) / 1000);

    const assistantMessages = messages.filter((m) => m.role === 'assistant');

    const pronScores = assistantMessages
      .map((m) => m.pronunciationScore)
      .filter((s): s is number => s !== undefined);
    const pronunciationScoreAvg = pronScores.length > 0
      ? pronScores.reduce((a, b) => a + b, 0) / pronScores.length
      : 0;

    const grammarCounts = assistantMessages.map((m) => m.grammarErrors?.length || 0);
    const grammarScoreAvg = grammarCounts.length > 0
      ? Math.max(0, 100 - (grammarCounts.reduce((a, b) => a + b, 0) / grammarCounts.length) * 10)
      : 0;

    const fluencyScores = assistantMessages
      .map((m) => m.fluencyMetrics)
      .filter((f): f is NonNullable<typeof f> => f !== undefined);
    const fluencyScoreAvg = fluencyScores.length > 0
      ? Math.min(100, fluencyScores.reduce((a, b) => a + b.wordsPerMinute, 0) / fluencyScores.length)
      : 0;

    const overallScore = (pronunciationScoreAvg + grammarScoreAvg + fluencyScoreAvg) / 3;

    const newVocab = assistantMessages.reduce((count, m) => {
      return count + (m.vocabularyHighlights?.filter((v) => v.isNew).length || 0);
    }, 0);

    const finalSession: ConversationSession = {
      ...currentSession,
      durationSeconds,
      totalMessages: messages.length,
      pronunciationScoreAvg,
      grammarScoreAvg,
      fluencyScoreAvg,
      overallScore,
      newVocabularyCount: newVocab,
      status: 'completed',
      endedAt: new Date().toISOString(),
      messages,
    };

    try {
      await conversationService.endSession(currentSession.id);
    } catch (error) {
      console.log('[useConversation] Error ending session on server:', error);
    }

    setCurrentSession(null);
    setMessages([]);
    setIsRecording(false);
    setIsAiSpeaking(false);
    setIsProcessing(false);
    setPartialTranscript('');

    console.log('[useConversation] Session ended. Duration:', durationSeconds, 's, Messages:', finalSession.totalMessages);

    return finalSession;
  }, [currentSession, messages]);

  const setRecording = useCallback((recording: boolean) => {
    setIsRecording(recording);
  }, []);

  const setAiSpeaking = useCallback((speaking: boolean) => {
    setIsAiSpeaking(speaking);
  }, []);

  const updatePartialTranscript = useCallback((text: string) => {
    setPartialTranscript(text);
  }, []);

  return {
    messages,
    currentSession,
    isRecording,
    isAiSpeaking,
    isProcessing,
    partialTranscript,
    lastAiAudioBase64,
    clearLastAiAudio: useCallback(() => setLastAiAudioBase64(null), []),
    startConversation,
    sendUserMessage,
    sendAudioMessage,
    endConversation,
    setRecording,
    setAiSpeaking,
    updatePartialTranscript,
  };
}
