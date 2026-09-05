import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
} from 'react-native';
import { ChevronDown, ChevronUp, AlertCircle, BookOpen, Sparkles } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { USE_NATIVE_DRIVER } from '@/constants/animation';
import { ConversationMessage } from '@/types';

interface ConversationBubbleProps {
  message: ConversationMessage;
  isStreaming?: boolean;
  onExpand?: () => void;
}

function TypingIndicator() {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animate = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: 1, duration: 300, useNativeDriver: USE_NATIVE_DRIVER }),
          Animated.timing(dot, { toValue: 0, duration: 300, useNativeDriver: USE_NATIVE_DRIVER }),
          Animated.delay(600 - delay),
        ])
      );

    const a1 = animate(dot1, 0);
    const a2 = animate(dot2, 200);
    const a3 = animate(dot3, 400);
    a1.start();
    a2.start();
    a3.start();

    return () => { a1.stop(); a2.stop(); a3.stop(); };
  }, [dot1, dot2, dot3]);

  return (
    <View style={styles.typingContainer}>
      {[dot1, dot2, dot3].map((dot, i) => (
        <Animated.View
          key={i}
          style={[
            styles.typingDot,
            {
              opacity: dot.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }),
              transform: [{ scale: dot.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.2] }) }],
            },
          ]}
        />
      ))}
    </View>
  );
}

function getPronunciationColor(score?: number): string {
  if (score === undefined) return 'transparent';
  if (score >= 80) return '#10B981';
  if (score >= 50) return '#F59E0B';
  return '#EF4444';
}

function getPronunciationLabel(score?: number): string {
  if (score === undefined) return '';
  if (score >= 80) return 'Great';
  if (score >= 50) return 'Good';
  return 'Needs work';
}

const ConversationBubble = React.memo(function ConversationBubble({
  message,
  isStreaming = false,
  onExpand,
}: ConversationBubbleProps) {
  const isUser = message.role === 'user';
  const [expanded, setExpanded] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(isUser ? 20 : -20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.timing(slideAnim, { toValue: 0, duration: 250, useNativeDriver: USE_NATIVE_DRIVER }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const hasDetails = isUser && (
    (message.grammarErrors && message.grammarErrors.length > 0) ||
    (message.vocabularyHighlights && message.vocabularyHighlights.length > 0) ||
    message.pronunciationScore !== undefined
  );

  const handleToggle = useCallback(() => {
    setExpanded(prev => !prev);
    onExpand?.();
  }, [onExpand]);

  const showTyping = isStreaming && !message.textContent;

  return (
    <Animated.View
      style={[
        styles.container,
        isUser ? styles.userContainer : styles.assistantContainer,
        { opacity: fadeAnim, transform: [{ translateX: slideAnim }] },
      ]}
    >
      {!isUser && (
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>🦊</Text>
        </View>
      )}

      <View style={[styles.bubbleWrapper, isUser ? styles.userWrapper : styles.assistantWrapper]}>
        <View style={[styles.bubble, isUser ? styles.userBubble : styles.assistantBubble]}>
          {showTyping ? (
            <TypingIndicator />
          ) : (
            <Text style={[styles.messageText, isUser ? styles.userText : styles.assistantText]}>
              {message.textContent}
              {isStreaming && <Text style={styles.cursor}>▌</Text>}
            </Text>
          )}

          {isUser && message.pronunciationScore !== undefined && (
            <View style={[styles.pronDot, { backgroundColor: getPronunciationColor(message.pronunciationScore) }]} />
          )}
        </View>

        {hasDetails && (
          <Pressable onPress={handleToggle} style={styles.expandButton} testID="expand-bubble">
            <Text style={styles.expandText}>
              {expanded ? 'Hide details' : 'Show details'}
            </Text>
            {expanded ? (
              <ChevronUp size={14} color={Colors.textMuted} />
            ) : (
              <ChevronDown size={14} color={Colors.textMuted} />
            )}
          </Pressable>
        )}

        {expanded && hasDetails && (
          <View style={styles.detailsPanel}>
            {message.pronunciationScore !== undefined && (
              <View style={styles.detailRow}>
                <View style={[styles.detailIconBg, { backgroundColor: getPronunciationColor(message.pronunciationScore) + '20' }]}>
                  <Sparkles size={14} color={getPronunciationColor(message.pronunciationScore)} />
                </View>
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>Pronunciation</Text>
                  <Text style={[styles.detailValue, { color: getPronunciationColor(message.pronunciationScore) }]}>
                    {message.pronunciationScore}% — {getPronunciationLabel(message.pronunciationScore)}
                  </Text>
                </View>
              </View>
            )}

            {message.grammarErrors && message.grammarErrors.length > 0 && (
              <View style={styles.detailSection}>
                <View style={styles.detailRow}>
                  <View style={[styles.detailIconBg, { backgroundColor: '#FEF2F2' }]}>
                    <AlertCircle size={14} color="#EF4444" />
                  </View>
                  <Text style={styles.detailLabel}>Grammar corrections</Text>
                </View>
                {message.grammarErrors.map((err, i) => (
                  <View key={i} style={styles.correctionItem}>
                    <Text style={styles.correctionOriginal}>{err.original}</Text>
                    <Text style={styles.correctionArrow}>→</Text>
                    <Text style={styles.correctionFixed}>{err.corrected}</Text>
                    <Text style={styles.correctionExplanation}>{err.explanation}</Text>
                  </View>
                ))}
              </View>
            )}

            {message.vocabularyHighlights && message.vocabularyHighlights.length > 0 && (
              <View style={styles.detailSection}>
                <View style={styles.detailRow}>
                  <View style={[styles.detailIconBg, { backgroundColor: '#EDE9FE' }]}>
                    <BookOpen size={14} color="#8B5CF6" />
                  </View>
                  <Text style={styles.detailLabel}>Vocabulary</Text>
                </View>
                {message.vocabularyHighlights.map((vocab, i) => (
                  <View key={i} style={styles.vocabItem}>
                    <Text style={styles.vocabWord}>{vocab.word}</Text>
                    <Text style={styles.vocabTranslation}>{vocab.translation}</Text>
                    {vocab.isNew && (
                      <View style={styles.newBadge}>
                        <Text style={styles.newBadgeText}>NEW</Text>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      </View>
    </Animated.View>
  );
});

export default ConversationBubble;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  userContainer: {
    justifyContent: 'flex-end',
  },
  assistantContainer: {
    justifyContent: 'flex-start',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    marginTop: 4,
  },
  avatarText: {
    fontSize: 16,
  },
  bubbleWrapper: {
    maxWidth: '78%',
  },
  userWrapper: {
    alignItems: 'flex-end',
  },
  assistantWrapper: {
    alignItems: 'flex-start',
  },
  bubble: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    position: 'relative' as const,
  },
  userBubble: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    backgroundColor: '#F3F4F6',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 21,
  },
  userText: {
    color: '#FFFFFF',
  },
  assistantText: {
    color: Colors.text,
  },
  cursor: {
    color: Colors.primary,
    fontSize: 15,
  },
  pronDot: {
    position: 'absolute' as const,
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  typingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.textMuted,
  },
  expandButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
    paddingVertical: 2,
  },
  expandText: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  detailsPanel: {
    marginTop: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  detailIconBg: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '500' as const,
    marginTop: 1,
  },
  detailSection: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  correctionItem: {
    marginLeft: 36,
    marginBottom: 8,
  },
  correctionOriginal: {
    fontSize: 13,
    color: '#EF4444',
    textDecorationLine: 'line-through' as const,
  },
  correctionArrow: {
    fontSize: 12,
    color: Colors.textMuted,
    marginVertical: 1,
  },
  correctionFixed: {
    fontSize: 13,
    color: '#10B981',
    fontWeight: '600' as const,
  },
  correctionExplanation: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
    fontStyle: 'italic' as const,
  },
  vocabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 36,
    marginBottom: 6,
    gap: 6,
  },
  vocabWord: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  vocabTranslation: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  newBadge: {
    backgroundColor: '#EDE9FE',
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  newBadgeText: {
    fontSize: 9,
    fontWeight: '700' as const,
    color: '#8B5CF6',
  },
});
