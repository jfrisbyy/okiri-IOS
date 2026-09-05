import { useState, useCallback } from 'react';
import { PronunciationScore, FoundationItem } from '@/types';
import { pronunciationTips } from '@/mocks/modules';

interface PronunciationResult {
  score: PronunciationScore;
  transcript: string;
  targetPhrase: string;
  matchPercentage: number;
  problemSounds?: string[];
  tip?: string;
  isExactMatch: boolean;
}

interface PronunciationCheckState {
  isListening: boolean;
  isProcessing: boolean;
  result: PronunciationResult | null;
  error: string | null;
  attempts: number;
}

const knownConfusions: Record<string, { correct: string; confused: string; sound: string }[]> = {
  'u-vs-ou': [
    { correct: 'tu', confused: 'tout', sound: 'u' },
    { correct: 'salut', confused: 'salou', sound: 'u' },
    { correct: 'rue', confused: 'roue', sound: 'u' },
    { correct: 'vu', confused: 'vous', sound: 'u' },
    { correct: 'plus', confused: 'plou', sound: 'u' },
  ],
  'nasal-on': [
    { correct: 'bon', confused: 'bonne', sound: 'on' },
    { correct: 'bonjour', confused: 'bonjoure', sound: 'on' },
    { correct: 'pardon', confused: 'pardone', sound: 'on' },
  ],
  'nasal-an': [
    { correct: 'enfant', confused: 'enfante', sound: 'an' },
    { correct: 'pendant', confused: 'pendante', sound: 'an' },
    { correct: 'comment', confused: 'commente', sound: 'an' },
  ],
};

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[.,!?;:'"]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function calculateMatchPercentage(target: string, transcript: string): number {
  const normalizedTarget = normalizeText(target);
  const normalizedTranscript = normalizeText(transcript);
  
  if (normalizedTarget === normalizedTranscript) return 100;
  
  const targetWords = normalizedTarget.split(' ');
  const transcriptWords = normalizedTranscript.split(' ');
  
  let matchedWords = 0;
  for (const targetWord of targetWords) {
    if (transcriptWords.some(tw => tw === targetWord || 
        levenshteinDistance(tw, targetWord) <= Math.ceil(targetWord.length * 0.3))) {
      matchedWords++;
    }
  }
  
  return Math.round((matchedWords / targetWords.length) * 100);
}

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[b.length][a.length];
}

function detectProblemSounds(
  target: string, 
  transcript: string, 
  knownProblemSounds?: string[]
): { detectedProblems: string[]; tip: string | null } {
  const detectedProblems: string[] = [];
  let tip: string | null = null;
  
  const normalizedTarget = normalizeText(target);
  const normalizedTranscript = normalizeText(transcript);
  
  if (knownProblemSounds) {
    for (const soundId of knownProblemSounds) {
      const confusions = knownConfusions[soundId];
      if (confusions) {
        for (const confusion of confusions) {
          if (normalizedTarget.includes(confusion.correct) && 
              normalizedTranscript.includes(confusion.confused)) {
            detectedProblems.push(soundId);
            const tipData = pronunciationTips[soundId];
            if (tipData) {
              tip = tipData.tip;
            }
            break;
          }
        }
      }
    }
  }
  
  return { detectedProblems, tip };
}

function determineScore(
  matchPercentage: number, 
  detectedProblems: string[]
): PronunciationScore {
  if (matchPercentage >= 90 && detectedProblems.length === 0) {
    return 'clear';
  } else if (matchPercentage >= 60) {
    return 'understandable';
  } else {
    return 'unclear';
  }
}

export function usePronunciationCheck() {
  const [state, setState] = useState<PronunciationCheckState>({
    isListening: false,
    isProcessing: false,
    result: null,
    error: null,
    attempts: 0,
  });

  const checkPronunciation = useCallback(async (
    targetPhrase: string,
    item?: FoundationItem
  ): Promise<PronunciationResult | null> => {
    console.log('Starting pronunciation check for:', targetPhrase);
    
    if (typeof window === 'undefined') {
      console.error('Window is undefined - not in browser context');
      setState(prev => ({ ...prev, error: 'Speech recognition not available' }));
      return null;
    }
    
    const hasSpeechRecognition = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
    console.log('Speech recognition available:', hasSpeechRecognition);
    
    if (!hasSpeechRecognition) {
      setState(prev => ({ ...prev, error: 'Speech recognition not supported. Please use Chrome or Edge browser.' }));
      return null;
    }

    setState(prev => ({ 
      ...prev, 
      isListening: true, 
      error: null, 
      result: null,
      attempts: prev.attempts + 1 
    }));

    return new Promise((resolve) => {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      console.log('SpeechRecognition instance created');
      
      recognition.lang = 'fr-FR';
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onresult = (event: any) => {
        console.log('Speech recognition result received');
        const transcript = event.results[0][0].transcript;
        const confidence = event.results[0][0].confidence;
        console.log('Transcript:', transcript, 'Confidence:', confidence);
        
        setState(prev => ({ ...prev, isListening: false, isProcessing: true }));
        
        const matchPercentage = calculateMatchPercentage(targetPhrase, transcript);
        const isExactMatch = matchPercentage === 100;
        
        const { detectedProblems, tip } = detectProblemSounds(
          targetPhrase, 
          transcript, 
          item?.problemSounds
        );
        
        const finalTip = tip || item?.pronunciationTip || null;
        const score = determineScore(matchPercentage, detectedProblems);
        
        const result: PronunciationResult = {
          score,
          transcript,
          targetPhrase,
          matchPercentage,
          problemSounds: detectedProblems.length > 0 ? detectedProblems : undefined,
          tip: score !== 'clear' ? (finalTip || undefined) : undefined,
          isExactMatch,
        };
        
        setState(prev => ({ 
          ...prev, 
          isProcessing: false, 
          result,
        }));
        
        resolve(result);
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        let errorMessage = 'Speech recognition error';
        if (event.error === 'no-speech') {
          errorMessage = 'No speech detected. Please try again.';
        } else if (event.error === 'audio-capture') {
          errorMessage = 'No microphone found. Please check your microphone.';
        } else if (event.error === 'not-allowed') {
          errorMessage = 'Microphone access denied. Please allow microphone access in your browser settings.';
        } else if (event.error === 'network') {
          errorMessage = 'Network error. Please check your connection.';
        } else if (event.error === 'aborted') {
          errorMessage = 'Recording was cancelled.';
        } else {
          errorMessage = `Speech error: ${event.error}`;
        }
        
        setState(prev => ({ 
          ...prev, 
          isListening: false, 
          isProcessing: false,
          error: errorMessage 
        }));
        resolve(null);
      };

      recognition.onend = () => {
        console.log('Speech recognition ended');
        setState(prev => ({ ...prev, isListening: false }));
      };

      try {
        console.log('Starting speech recognition...');
        recognition.start();
        console.log('Speech recognition started successfully');
      } catch (err) {
        console.error('Error starting speech recognition:', err);
        setState(prev => ({ 
          ...prev, 
          isListening: false, 
          error: 'Failed to start recording. Please try again.' 
        }));
        resolve(null);
      }
    });
  }, []);

  const resetAttempts = useCallback(() => {
    setState(prev => ({ ...prev, attempts: 0, result: null, error: null }));
  }, []);

  const getScoreColor = useCallback((score: PronunciationScore): string => {
    switch (score) {
      case 'clear': return '#22C55E';
      case 'understandable': return '#F59E0B';
      case 'unclear': return '#EF4444';
    }
  }, []);

  const getScoreLabel = useCallback((score: PronunciationScore): string => {
    switch (score) {
      case 'clear': return 'Clear!';
      case 'understandable': return 'Understandable';
      case 'unclear': return 'Try again';
    }
  }, []);

  const getScoreIcon = useCallback((score: PronunciationScore): string => {
    switch (score) {
      case 'clear': return 'check-circle';
      case 'understandable': return 'alert-circle';
      case 'unclear': return 'x-circle';
    }
  }, []);

  return {
    ...state,
    checkPronunciation,
    resetAttempts,
    getScoreColor,
    getScoreLabel,
    getScoreIcon,
  };
}
