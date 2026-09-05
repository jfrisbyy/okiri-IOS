import React, { useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Platform,
  Share,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import ViewShot, { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import {
  Flame,
  Zap,
  BookOpen,
  Shield,
  Share2,
  Star,
} from 'lucide-react-native';
import { USE_NATIVE_DRIVER } from '@/constants/animation';
import Kiri from '@/components/Kiri';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = Math.min(SCREEN_WIDTH - 48, 340);
const CARD_HEIGHT = CARD_WIDTH * (1920 / 1080);

interface ShareableStatCardProps {
  userName: string;
  streakCount: number;
  totalXP: number;
  cefrLevel: string | null;
  wordsLearned: number;
  visible: boolean;
  onClose: () => void;
}

export default function ShareableStatCard({
  userName,
  streakCount,
  totalXP,
  cefrLevel,
  wordsLearned,
  visible,
  onClose,
}: ShareableStatCardProps) {
  const viewShotRef = useRef<ViewShot>(null);
  const [isSharing, setIsSharing] = useState<boolean>(false);
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(0.85)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const shareScale = useRef(new Animated.Value(1)).current;

  const level = Math.floor(totalXP / 500) + 1;

  React.useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(overlayOpacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.spring(cardScale, {
          toValue: 1,
          friction: 7,
          tension: 80,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(cardOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(overlayOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(cardScale, {
          toValue: 0.85,
          duration: 200,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(cardOpacity, {
          toValue: 0,
          duration: 150,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ]).start();
    }
  }, [visible, overlayOpacity, cardScale, cardOpacity]);

  const handleShare = useCallback(async () => {
    setIsSharing(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    Animated.sequence([
      Animated.timing(shareScale, { toValue: 0.92, duration: 80, useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.timing(shareScale, { toValue: 1, duration: 80, useNativeDriver: USE_NATIVE_DRIVER }),
    ]).start();

    try {
      if (Platform.OS === 'web') {
        await Share.share({
          message: `I'm learning French with Okiri! 🇫🇷\n\n🔥 ${streakCount} day streak\n⚡ ${totalXP} XP (Level ${level})\n${cefrLevel ? `🛡️ CEFR ${cefrLevel}` : ''}\n📚 ${wordsLearned} words learned\n\nokiriapp.com`,
        });
        setIsSharing(false);
        return;
      }

      const uri = await captureRef(viewShotRef, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
      });

      console.log('[ShareableStatCard] Captured image at:', uri);

      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(uri, {
          mimeType: 'image/png',
          dialogTitle: 'Share your Okiri progress',
          UTI: 'public.png',
        });
      } else {
        await Share.share({
          message: `I'm learning French with Okiri! 🇫🇷\n\n🔥 ${streakCount} day streak\n⚡ ${totalXP} XP (Level ${level})\n${cefrLevel ? `🛡️ CEFR ${cefrLevel}` : ''}\n📚 ${wordsLearned} words learned\n\nokiriapp.com`,
        });
      }
    } catch (error) {
      console.log('[ShareableStatCard] Share error:', error);
    } finally {
      setIsSharing(false);
    }
  }, [streakCount, totalXP, level, cefrLevel, wordsLearned, shareScale]);

  if (!visible) return null;

  const taglines = [
    'Learning French one word at a time',
    'Building fluency day by day',
    'On the path to French mastery',
    'Making progress, one lesson at a time',
  ];
  const tagline = taglines[Math.floor(totalXP / 100) % taglines.length];

  return (
    <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]}>
      <Pressable style={styles.overlayBackdrop} onPress={onClose} />

      <Animated.View
        style={[
          styles.cardWrapper,
          {
            opacity: cardOpacity,
            transform: [{ scale: cardScale }],
          },
        ]}
      >
        <ViewShot
          ref={viewShotRef}
          options={{ format: 'png', quality: 1 }}
          style={styles.viewShot}
        >
          <View style={[styles.card, { width: CARD_WIDTH, height: CARD_HEIGHT }]}>
            <LinearGradient
              colors={['#1A0E2E', '#2D1B4E', '#F97316']}
              locations={[0, 0.55, 1]}
              style={StyleSheet.absoluteFill}
              start={{ x: 0.2, y: 0 }}
              end={{ x: 0.8, y: 1 }}
            />

            <View style={styles.patternOverlay}>
              {Array.from({ length: 6 }).map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.patternCircle,
                    {
                      width: 80 + i * 40,
                      height: 80 + i * 40,
                      borderRadius: 40 + i * 20,
                      top: 30 + i * 50,
                      right: -20 + i * 10,
                      opacity: 0.04 + i * 0.01,
                    },
                  ]}
                />
              ))}
            </View>

            <View style={styles.cardContent}>
              <View style={styles.topSection}>
                <View style={styles.brandRow}>
                  <View style={styles.logoCircle}>
                    <Text style={styles.logoText}>O</Text>
                  </View>
                  <Text style={styles.brandName}>Okiri</Text>
                </View>

                <View style={styles.mascotArea}>
                  <Kiri mood="celebrating" size={80} />
                </View>
              </View>

              <View style={styles.nameSection}>
                <Text style={styles.userName} numberOfLines={1}>
                  {userName || 'French Learner'}
                </Text>
                <Text style={styles.tagline}>{tagline}</Text>
              </View>

              <View style={styles.statsGrid}>
                <View style={styles.statBox}>
                  <View style={styles.statIconRow}>
                    <Flame size={18} color="#FF6B35" />
                  </View>
                  <Text style={styles.statNumber}>{streakCount}</Text>
                  <Text style={styles.statDesc}>Day Streak</Text>
                </View>

                <View style={styles.statBox}>
                  <View style={styles.statIconRow}>
                    <Zap size={18} color="#FBBF24" />
                  </View>
                  <Text style={styles.statNumber}>{totalXP.toLocaleString()}</Text>
                  <Text style={styles.statDesc}>Total XP</Text>
                </View>

                <View style={styles.statBox}>
                  <View style={styles.statIconRow}>
                    <Star size={18} color="#A78BFA" />
                  </View>
                  <Text style={styles.statNumber}>Lv.{level}</Text>
                  <Text style={styles.statDesc}>Level</Text>
                </View>
              </View>

              <View style={styles.bottomStats}>
                {cefrLevel && (
                  <View style={styles.cefrChip}>
                    <Shield size={14} color="#fff" />
                    <Text style={styles.cefrText}>CEFR {cefrLevel}</Text>
                  </View>
                )}

                <View style={styles.wordsChip}>
                  <BookOpen size={14} color="#fff" />
                  <Text style={styles.wordsText}>{wordsLearned} words learned</Text>
                </View>
              </View>

              <View style={styles.flagSection}>
                <Text style={styles.flagEmoji}>🇫🇷</Text>
              </View>

              <View style={styles.footer}>
                <View style={styles.footerDivider} />
                <Text style={styles.footerUrl}>okiriapp.com</Text>
              </View>
            </View>
          </View>
        </ViewShot>

        <Animated.View style={{ transform: [{ scale: shareScale }] }}>
          <Pressable
            style={styles.shareButton}
            onPress={handleShare}
            disabled={isSharing}
            testID="share-stat-card"
          >
            {isSharing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Share2 size={20} color="#fff" />
                <Text style={styles.shareButtonText}>Share</Text>
              </>
            )}
          </Pressable>
        </Animated.View>

        <Pressable style={styles.closeButton} onPress={onClose} testID="close-stat-card">
          <Text style={styles.closeButtonText}>Close</Text>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

interface ShareProgressButtonProps {
  onPress: () => void;
  style?: any;
  variant?: 'primary' | 'secondary';
}

export function ShareProgressButton({ onPress, style, variant = 'secondary' }: ShareProgressButtonProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePress = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.95, duration: 80, useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 80, useNativeDriver: USE_NATIVE_DRIVER }),
    ]).start(() => onPress());
  }, [onPress, scaleAnim]);

  const isPrimary = variant === 'primary';

  return (
    <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, style]}>
      <Pressable
        style={[
          styles.shareProgressBtn,
          isPrimary && styles.shareProgressBtnPrimary,
        ]}
        onPress={handlePress}
        testID="share-progress-button"
      >
        <Share2 size={16} color={isPrimary ? '#fff' : '#F97316'} />
        <Text
          style={[
            styles.shareProgressBtnText,
            isPrimary && styles.shareProgressBtnTextPrimary,
          ]}
        >
          Share My Progress
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  cardWrapper: {
    alignItems: 'center',
    gap: 16,
  },
  viewShot: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 16,
  },
  card: {
    overflow: 'hidden',
    borderRadius: 20,
  },
  patternOverlay: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  patternCircle: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  cardContent: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 20,
    justifyContent: 'space-between',
  },
  topSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(249,115,22,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontSize: 20,
    fontWeight: '900' as const,
    color: '#fff',
    letterSpacing: -1,
  },
  brandName: {
    fontSize: 22,
    fontWeight: '800' as const,
    color: '#fff',
    letterSpacing: -0.5,
  },
  mascotArea: {
    marginTop: -4,
  },
  nameSection: {
    marginTop: 4,
  },
  userName: {
    fontSize: 28,
    fontWeight: '900' as const,
    color: '#fff',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  tagline: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: 'rgba(255,255,255,0.65)',
    fontStyle: 'italic' as const,
    letterSpacing: 0.2,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  statBox: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  statIconRow: {
    marginBottom: 8,
  },
  statNumber: {
    fontSize: 22,
    fontWeight: '900' as const,
    color: '#fff',
    letterSpacing: -0.5,
  },
  statDesc: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: 'rgba(255,255,255,0.55)',
    marginTop: 4,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  bottomStats: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  cefrChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(167,139,250,0.25)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.3)',
  },
  cefrText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#D4BBFF',
  },
  wordsChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(249,115,22,0.2)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.25)',
  },
  wordsText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#FDBA74',
  },
  flagSection: {
    alignItems: 'center',
  },
  flagEmoji: {
    fontSize: 36,
  },
  footer: {
    alignItems: 'center',
    gap: 10,
  },
  footerDivider: {
    width: 40,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 1,
  },
  footerUrl: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: 1,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#F97316',
    paddingVertical: 14,
    paddingHorizontal: 36,
    borderRadius: 14,
    shadowColor: '#F97316',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
    minWidth: 160,
  },
  shareButtonText: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: '#fff',
  },
  closeButton: {
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  closeButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: 'rgba(255,255,255,0.7)',
  },
  shareProgressBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFF7ED',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFEDD5',
  },
  shareProgressBtnPrimary: {
    backgroundColor: '#F97316',
    borderColor: '#F97316',
  },
  shareProgressBtnText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#F97316',
  },
  shareProgressBtnTextPrimary: {
    color: '#fff',
  },
});
