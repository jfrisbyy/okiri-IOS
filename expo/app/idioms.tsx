import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  ArrowLeft, 
  Search, 
  Volume2,
  ChevronDown,
  ChevronUp,
  X,
  Play,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { USE_NATIVE_DRIVER } from '@/constants/animation';
import { 
  frenchIdioms, 
  IdiomCategory, 
  categoryLabels, 
  categoryEmojis,
  FrenchIdiom,
  getIdiomsByCategory,
  searchIdioms,
} from '@/data/idiomsData';

export default function IdiomsScreen() {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState<IdiomCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedIdiom, setExpandedIdiom] = useState<string | null>(null);
  const [isPlayingTTS, setIsPlayingTTS] = useState<string | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  }, [fadeAnim]);

  const categories: (IdiomCategory | 'all')[] = [
    'all',
    'animals',
    'food',
    'body',
    'weather',
    'emotions',
    'money',
    'time',
    'relationships',
    'work',
    'everyday',
  ];

  const filteredIdioms = useMemo(() => {
    let idioms = selectedCategory === 'all' 
      ? frenchIdioms 
      : getIdiomsByCategory(selectedCategory);
    
    if (searchQuery.trim()) {
      idioms = searchIdioms(searchQuery).filter(
        idiom => selectedCategory === 'all' || idiom.category === selectedCategory
      );
    }
    
    return idioms;
  }, [selectedCategory, searchQuery]);

  const playTTS = async (text: string, idiomId: string) => {
    if (isPlayingTTS) return;
    setIsPlayingTTS(idiomId);
    
    try {
      const response = await fetch('/api/text-to-speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voiceId: 'XB0fDUnXU5powFXDhCwa' }),
      });

      if (response.ok) {
        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        
        if (currentAudioRef.current) {
          currentAudioRef.current.pause();
          currentAudioRef.current = null;
        }
        
        const audio = new Audio(audioUrl);
        currentAudioRef.current = audio;
        
        audio.onended = () => {
          setIsPlayingTTS(null);
          URL.revokeObjectURL(audioUrl);
        };
        
        audio.onerror = () => {
          setIsPlayingTTS(null);
          URL.revokeObjectURL(audioUrl);
        };
        
        await audio.play();
      } else {
        setIsPlayingTTS(null);
      }
    } catch (error) {
      console.error('TTS error:', error);
      setIsPlayingTTS(null);
    }
  };

  const toggleExpand = (idiomId: string) => {
    setExpandedIdiom(expandedIdiom === idiomId ? null : idiomId);
  };

  const renderIdiomCard = (idiom: FrenchIdiom) => {
    const isExpanded = expandedIdiom === idiom.id;
    const isPlaying = isPlayingTTS === idiom.id;

    return (
      <Pressable
        key={idiom.id}
        style={[styles.idiomCard, isExpanded && styles.idiomCardExpanded]}
        onPress={() => toggleExpand(idiom.id)}
      >
        <View style={styles.idiomHeader}>
          <View style={styles.idiomTitleRow}>
            <Text style={styles.categoryEmoji}>
              {categoryEmojis[idiom.category]}
            </Text>
            <View style={styles.idiomTextContainer}>
              <Text style={styles.frenchText}>{idiom.french}</Text>
              <Text style={styles.meaningText}>{idiom.meaning}</Text>
            </View>
          </View>
          <View style={styles.idiomActions}>
            <Pressable
              style={[styles.ttsButton, isPlaying && styles.ttsButtonActive]}
              onPress={(e) => {
                e.stopPropagation();
                playTTS(idiom.french, idiom.id);
              }}
            >
              <Volume2 size={18} color={isPlaying ? Colors.textLight : Colors.primary} />
            </Pressable>
            {isExpanded ? (
              <ChevronUp size={20} color={Colors.textMuted} />
            ) : (
              <ChevronDown size={20} color={Colors.textMuted} />
            )}
          </View>
        </View>

        {isExpanded && (
          <View style={styles.expandedContent}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Literal:</Text>
              <Text style={styles.detailText}>{idiom.literal}</Text>
            </View>
            
            <View style={styles.exampleContainer}>
              <Text style={styles.exampleLabel}>Example:</Text>
              <View style={styles.exampleRow}>
                <Text style={styles.exampleFrench}>{idiom.example}</Text>
                <Pressable
                  style={styles.exampleTtsButton}
                  onPress={() => playTTS(idiom.example, idiom.id + '-example')}
                >
                  <Volume2 size={14} color={Colors.primary} />
                </Pressable>
              </View>
              <Text style={styles.exampleTranslation}>{idiom.exampleTranslation}</Text>
            </View>
          </View>
        )}
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <Animated.View style={[styles.animatedContainer, { opacity: fadeAnim }]}>
          <LinearGradient
            colors={['#6D28D9', '#8B5CF6']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.headerGradient}
          >
            <Pressable 
              style={styles.backButton}
              onPress={() => router.push('/(tabs)/home')}
            >
              <ArrowLeft size={24} color={Colors.textLight} />
            </Pressable>
            <View style={styles.headerContent}>
              <Text style={styles.title}>French Idioms</Text>
              <Text style={styles.subtitle}>
                {frenchIdioms.length} expressions to master
              </Text>
            </View>
            <Pressable 
              style={styles.practiceButton}
              onPress={() => router.push('/idiom-practice')}
            >
              <Play size={16} color={Colors.primary} />
              <Text style={styles.practiceButtonText}>Practice</Text>
            </Pressable>
          </LinearGradient>

          <View style={styles.searchContainer}>
            <View style={styles.searchInputContainer}>
              <Search size={18} color={Colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search idioms..."
                placeholderTextColor={Colors.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <Pressable onPress={() => setSearchQuery('')}>
                  <X size={18} color={Colors.textMuted} />
                </Pressable>
              )}
            </View>
          </View>

          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.categoryScroll}
            contentContainerStyle={styles.categoryScrollContent}
          >
            {categories.map((category) => (
              <Pressable
                key={category}
                style={[
                  styles.categoryChip,
                  selectedCategory === category && styles.categoryChipActive,
                ]}
                onPress={() => setSelectedCategory(category)}
              >
                {category !== 'all' && (
                  <Text style={styles.categoryChipEmoji}>
                    {categoryEmojis[category as IdiomCategory]}
                  </Text>
                )}
                <Text
                  style={[
                    styles.categoryChipText,
                    selectedCategory === category && styles.categoryChipTextActive,
                  ]}
                >
                  {category === 'all' ? 'All' : categoryLabels[category as IdiomCategory]}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <ScrollView 
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.resultsCount}>
              {filteredIdioms.length} idiom{filteredIdioms.length !== 1 ? 's' : ''}
            </Text>
            
            {filteredIdioms.map(renderIdiomCard)}
            
            {filteredIdioms.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No idioms found</Text>
                <Text style={styles.emptySubtext}>Try a different search term</Text>
              </View>
            )}
          </ScrollView>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  safeArea: {
    flex: 1,
  },
  animatedContainer: {
    flex: 1,
  },
  backButton: {
    position: 'absolute',
    top: 16,
    left: 16,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerGradient: {
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 24,
    position: 'relative',
    overflow: 'hidden',
  },
  headerContent: {
    zIndex: 1,
  },
  practiceButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.textLight,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  practiceButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  headerDecoration: {
    position: 'absolute',
    right: -40,
    top: -20,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.textLight,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.85)',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
  },
  categoryScroll: {
    maxHeight: 50,
  },
  categoryScrollContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.backgroundCard,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    gap: 6,
  },
  categoryChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  categoryChipEmoji: {
    fontSize: 14,
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.text,
  },
  categoryChipTextActive: {
    color: Colors.textLight,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  resultsCount: {
    fontSize: 13,
    color: Colors.textMuted,
    marginBottom: 12,
  },
  idiomCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  idiomCardExpanded: {
    borderColor: Colors.primary,
    borderWidth: 1.5,
  },
  idiomHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  idiomTitleRow: {
    flexDirection: 'row',
    flex: 1,
    gap: 12,
  },
  categoryEmoji: {
    fontSize: 24,
  },
  idiomTextContainer: {
    flex: 1,
  },
  frenchText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  meaningText: {
    fontSize: 14,
    color: Colors.textMuted,
  },
  idiomActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ttsButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ttsButtonActive: {
    backgroundColor: Colors.primary,
  },
  expandedContent: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  detailRow: {
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailText: {
    fontSize: 15,
    color: Colors.text,
    fontStyle: 'italic',
  },
  exampleContainer: {
    backgroundColor: Colors.background,
    borderRadius: 8,
    padding: 12,
  },
  exampleLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  exampleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  exampleFrench: {
    flex: 1,
    fontSize: 15,
    color: Colors.primary,
    fontWeight: '500',
  },
  exampleTtsButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exampleTranslation: {
    fontSize: 14,
    color: Colors.textMuted,
    marginTop: 6,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.textMuted,
  },
});
