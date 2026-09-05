import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useRouter, useNavigation } from 'expo-router';
import { safeGoBack } from '@/utils/navigation';
import { 
  ArrowLeft, 
  ArrowRightLeft, 
  Mic, 
  MicOff, 
  Volume2, 
  Keyboard,
  Headphones,
  Copy,
  Check,
} from 'lucide-react-native';
import Colors from '@/constants/colors';

type Mode = 'type' | 'listen';
type Language = 'en' | 'fr';

export const unstable_settings = {
  headerShown: false,
};

export default function TranslatorScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const [mode, setMode] = useState<Mode>('type');
  const [sourceLanguage, setSourceLanguage] = useState<Language>('en');
  const [inputText, setInputText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [copied, setCopied] = useState(false);
  const recognitionRef = useRef<any>(null);

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const targetLanguage = sourceLanguage === 'en' ? 'fr' : 'en';

  const languageNames = {
    en: 'English',
    fr: 'French',
  };

  useEffect(() => {
    if (Platform.OS === 'web' && 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = sourceLanguage === 'fr' ? 'fr-FR' : 'en-US';

      recognitionRef.current.onresult = (event: any) => {
        let transcript = '';
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        setInputText(transcript);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [sourceLanguage]);

  const swapLanguages = () => {
    setSourceLanguage(targetLanguage);
    setInputText(translatedText);
    setTranslatedText(inputText);
    
    if (recognitionRef.current) {
      recognitionRef.current.lang = targetLanguage === 'fr' ? 'fr-FR' : 'en-US';
    }
  };

  const translateText = async () => {
    if (!inputText.trim()) return;

    setIsTranslating(true);
    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: inputText,
          sourceLanguage,
          targetLanguage,
        }),
      });

      if (!response.ok) {
        throw new Error('Translation failed');
      }

      const data = await response.json();
      setTranslatedText(data.translation || '');
    } catch (error) {
      console.error('Translation error:', error);
      setTranslatedText('Translation failed. Please try again.');
    } finally {
      setIsTranslating(false);
    }
  };

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert('Speech recognition is not supported in this browser.');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setInputText('');
      setTranslatedText('');
      recognitionRef.current.lang = sourceLanguage === 'fr' ? 'fr-FR' : 'en-US';
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const speakText = (text: string, lang: Language) => {
    if (Platform.OS === 'web' && 'speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang === 'fr' ? 'fr-FR' : 'en-US';
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    }
  };

  const copyToClipboard = async () => {
    if (Platform.OS === 'web') {
      try {
        await navigator.clipboard.writeText(translatedText);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    }
  };

  return (
    <View style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <Pressable onPress={() => safeGoBack()} style={styles.backButton}>
              <ArrowLeft size={24} color={Colors.primary} />
            </Pressable>
          </View>
        </SafeAreaView>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.modeSelector}>
          <Pressable
            style={[styles.modeButton, mode === 'type' && styles.modeButtonActive]}
            onPress={() => setMode('type')}
          >
            <Keyboard size={18} color={mode === 'type' ? '#FFFFFF' : Colors.textSecondary} />
            <Text style={[styles.modeButtonText, mode === 'type' && styles.modeButtonTextActive]}>
              Type
            </Text>
          </Pressable>
          <Pressable
            style={[styles.modeButton, mode === 'listen' && styles.modeButtonActive]}
            onPress={() => setMode('listen')}
          >
            <Headphones size={18} color={mode === 'listen' ? '#FFFFFF' : Colors.textSecondary} />
            <Text style={[styles.modeButtonText, mode === 'listen' && styles.modeButtonTextActive]}>
              Listen
            </Text>
          </Pressable>
        </View>

        <View style={styles.languageSelector}>
          <View style={styles.languageBox}>
            <Text style={styles.languageLabel}>{languageNames[sourceLanguage]}</Text>
          </View>
          <Pressable style={styles.swapButton} onPress={swapLanguages}>
            <ArrowRightLeft size={20} color={Colors.primary} />
          </Pressable>
          <View style={styles.languageBox}>
            <Text style={styles.languageLabel}>{languageNames[targetLanguage]}</Text>
          </View>
        </View>

        <View style={styles.inputCard}>
          <View style={styles.inputHeader}>
            <Text style={styles.inputLabel}>{languageNames[sourceLanguage]}</Text>
            {inputText && (
              <Pressable 
                style={styles.speakButton}
                onPress={() => speakText(inputText, sourceLanguage)}
              >
                <Volume2 size={18} color={Colors.primary} />
              </Pressable>
            )}
          </View>
          
          {mode === 'type' ? (
            <TextInput
              style={styles.textInput}
              placeholder={`Type in ${languageNames[sourceLanguage]}...`}
              placeholderTextColor={Colors.textSecondary}
              value={inputText}
              onChangeText={setInputText}
              multiline
              textAlignVertical="top"
            />
          ) : (
            <View style={styles.listenContainer}>
              <Pressable
                style={[styles.micButton, isListening && styles.micButtonActive]}
                onPress={toggleListening}
              >
                {isListening ? (
                  <MicOff size={32} color="#FFFFFF" />
                ) : (
                  <Mic size={32} color="#FFFFFF" />
                )}
              </Pressable>
              <Text style={styles.listenHint}>
                {isListening ? 'Tap to stop listening...' : `Tap to speak in ${languageNames[sourceLanguage]}`}
              </Text>
              {inputText && (
                <View style={styles.transcriptBox}>
                  <Text style={styles.transcriptText}>{inputText}</Text>
                </View>
              )}
            </View>
          )}
        </View>

        <Pressable
          style={[styles.translateButton, !inputText.trim() && styles.translateButtonDisabled]}
          onPress={translateText}
          disabled={!inputText.trim() || isTranslating}
        >
          {isTranslating ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.translateButtonText}>Translate</Text>
          )}
        </Pressable>

        {translatedText && (
          <View style={styles.outputCard}>
            <View style={styles.outputHeader}>
              <Text style={styles.outputLabel}>{languageNames[targetLanguage]}</Text>
              <View style={styles.outputActions}>
                <Pressable 
                  style={styles.actionButton}
                  onPress={() => speakText(translatedText, targetLanguage)}
                >
                  <Volume2 size={18} color={Colors.primary} />
                </Pressable>
                <Pressable 
                  style={styles.actionButton}
                  onPress={copyToClipboard}
                >
                  {copied ? (
                    <Check size={18} color={Colors.primary} />
                  ) : (
                    <Copy size={18} color={Colors.primary} />
                  )}
                </Pressable>
              </View>
            </View>
            <Text style={styles.outputText}>{translatedText}</Text>
          </View>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  safeArea: {
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  modeSelector: {
    flexDirection: 'row',
    backgroundColor: Colors.backgroundCard,
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 8,
  },
  modeButtonActive: {
    backgroundColor: Colors.primary,
  },
  modeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  modeButtonTextActive: {
    color: '#FFFFFF',
  },
  languageSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    gap: 12,
  },
  languageBox: {
    flex: 1,
    backgroundColor: Colors.backgroundCard,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  languageLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  swapButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primaryLight + '30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 180,
  },
  inputHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  speakButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primaryLight + '30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textInput: {
    fontSize: 16,
    color: Colors.text,
    minHeight: 100,
    lineHeight: 24,
  },
  listenContainer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  micButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  micButtonActive: {
    backgroundColor: '#EF4444',
  },
  listenHint: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  transcriptBox: {
    marginTop: 16,
    padding: 12,
    backgroundColor: Colors.background,
    borderRadius: 8,
    width: '100%',
  },
  transcriptText: {
    fontSize: 16,
    color: Colors.text,
    lineHeight: 24,
  },
  translateButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  translateButtonDisabled: {
    opacity: 0.5,
  },
  translateButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  outputCard: {
    backgroundColor: Colors.primaryLight + '15',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.primary + '30',
  },
  outputHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  outputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  outputActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primaryLight + '30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  outputText: {
    fontSize: 18,
    color: Colors.text,
    lineHeight: 28,
    fontWeight: '500',
  },
  bottomSpacer: {
    height: 40,
  },
});
