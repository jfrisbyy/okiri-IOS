import React, { useRef, useState, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  TextStyle,
  ViewStyle,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';

interface SelectableWordsProps {
  text: string;
  isActive: boolean;
  savedWords: Set<string>;
  onWordTap: (word: string, context: string) => void;
  onPhraseSelected: (phrase: string, context: string) => void;
  wordStyle: TextStyle;
  activeWordStyle?: TextStyle;
  savedWordStyle?: TextStyle;
  containerStyle?: ViewStyle;
  selectionColor?: string;
  onSelectionStart?: () => void;
  segmentIndex?: number;
  crossSegmentAnchor?: { segmentIndex: number; wordIndex: number } | null;
  onCrossSegmentAnchor?: (segmentIndex: number, wordIndex: number) => void;
  onCrossSegmentTap?: (segmentIndex: number, wordIndex: number) => void;
}

interface SelectionState {
  anchor: number;
  end: number;
}

function SelectableWordsInner({
  text,
  isActive,
  savedWords,
  onWordTap,
  onPhraseSelected,
  wordStyle,
  activeWordStyle,
  savedWordStyle,
  containerStyle,
  selectionColor = 'rgba(249, 115, 22, 0.3)',
  onSelectionStart,
  segmentIndex,
  crossSegmentAnchor,
  onCrossSegmentAnchor,
  onCrossSegmentTap,
}: SelectableWordsProps) {
  const words = useMemo(() => text.split(/\s+/).filter((w) => w.length > 0), [text]);
  const [selection, setSelection] = useState<SelectionState | null>(null);

  const wordsRef = useRef(words);
  wordsRef.current = words;
  const textRef = useRef(text);
  textRef.current = text;
  const onWordTapRef = useRef(onWordTap);
  onWordTapRef.current = onWordTap;
  const onPhraseSelectedRef = useRef(onPhraseSelected);
  onPhraseSelectedRef.current = onPhraseSelected;
  const onSelectionStartRef = useRef(onSelectionStart);
  onSelectionStartRef.current = onSelectionStart;
  const onCrossSegmentAnchorRef = useRef(onCrossSegmentAnchor);
  onCrossSegmentAnchorRef.current = onCrossSegmentAnchor;
  const onCrossSegmentTapRef = useRef(onCrossSegmentTap);
  onCrossSegmentTapRef.current = onCrossSegmentTap;
  const segmentIndexRef = useRef(segmentIndex);
  segmentIndexRef.current = segmentIndex;
  const crossSegmentAnchorRef = useRef(crossSegmentAnchor);
  crossSegmentAnchorRef.current = crossSegmentAnchor;
  const selectionRef = useRef<SelectionState | null>(null);
  const autoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    selectionRef.current = selection;
  }, [selection]);

  useEffect(() => {
    return () => {
      if (autoTimeoutRef.current) clearTimeout(autoTimeoutRef.current);
    };
  }, []);

  const clearAutoTimeout = useCallback(() => {
    if (autoTimeoutRef.current) {
      clearTimeout(autoTimeoutRef.current);
      autoTimeoutRef.current = null;
    }
  }, []);

  const handleWordTap = useCallback((index: number) => {
    const anchor = crossSegmentAnchorRef.current;
    if (anchor && anchor.segmentIndex !== segmentIndexRef.current) {
      clearAutoTimeout();
      if (onCrossSegmentTapRef.current && segmentIndexRef.current !== undefined) {
        console.log('[SelectableWords] Cross-segment tap at seg:', segmentIndexRef.current, 'word:', index);
        onCrossSegmentTapRef.current(segmentIndexRef.current, index);
      }
      setSelection(null);
      return;
    }

    const sel = selectionRef.current;
    if (sel !== null) {
      clearAutoTimeout();
      const start = Math.min(sel.anchor, index);
      const end = Math.max(sel.anchor, index);

      if (start === end) {
        const w = wordsRef.current[start];
        if (w) {
          console.log('[SelectableWords] Word tapped (from selection):', w);
          onWordTapRef.current(w, textRef.current);
        }
      } else {
        const phrase = wordsRef.current.slice(start, end + 1).join(' ');
        console.log('[SelectableWords] Phrase selected:', phrase);
        onPhraseSelectedRef.current(phrase, textRef.current);
      }

      setSelection({ anchor: start, end });
      setTimeout(() => setSelection(null), 500);
      return;
    }

    const word = wordsRef.current[index];
    if (word) {
      console.log('[SelectableWords] Word tapped:', word);
      onWordTapRef.current(word, textRef.current);
    }
  }, [clearAutoTimeout]);

  const handleWordLongPress = useCallback((index: number) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    console.log('[SelectableWords] Long press - selection mode at index:', index);
    setSelection({ anchor: index, end: index });

    if (onSelectionStartRef.current) {
      onSelectionStartRef.current();
    }

    if (onCrossSegmentAnchorRef.current && segmentIndexRef.current !== undefined) {
      onCrossSegmentAnchorRef.current(segmentIndexRef.current, index);
    }

    clearAutoTimeout();
    autoTimeoutRef.current = setTimeout(() => {
      const sel = selectionRef.current;
      if (sel && sel.anchor === index && sel.end === index) {
        const w = wordsRef.current[index];
        if (w) {
          console.log('[SelectableWords] Auto-lookup after long press timeout:', w);
          onWordTapRef.current(w, textRef.current);
        }
        setSelection(null);
      }
    }, 4000);
  }, [clearAutoTimeout]);

  if (words.length === 0) {
    return <View style={containerStyle} />;
  }

  const hasCrossAnchorFromThisSegment = crossSegmentAnchor != null && crossSegmentAnchor.segmentIndex === segmentIndex;
  const hasCrossAnchorFromOtherSegment = crossSegmentAnchor != null && crossSegmentAnchor.segmentIndex !== segmentIndex;
  const isInSelectionMode = selection !== null || hasCrossAnchorFromThisSegment;
  const crossAnchorWordIdx = hasCrossAnchorFromThisSegment ? crossSegmentAnchor.wordIndex : -1;
  const selStart = selection ? Math.min(selection.anchor, selection.end) : crossAnchorWordIdx;
  const selEnd = selection ? Math.max(selection.anchor, selection.end) : crossAnchorWordIdx;

  return (
    <View style={[localStyles.container, containerStyle]}>
      {words.map((word, idx) => {
        const clean = word.replace(/[.,;:!?'"()\u00AB\u00BB\-\u2026]/g, '').toLowerCase();
        const isSaved = savedWords.has(clean);
        const isInSelection = isInSelectionMode && idx >= selStart && idx <= selEnd;
        const isAnchor = isInSelectionMode && selection !== null && idx === selection.anchor;

        return (
          <Pressable
            key={`sw-${idx}`}
            onPress={() => handleWordTap(idx)}
            onLongPress={() => handleWordLongPress(idx)}
            delayLongPress={Platform.OS === 'web' ? 300 : 350}
            style={({ pressed }) => [
              isInSelection
                ? [localStyles.wordWrap, { backgroundColor: selectionColor }]
                : undefined,
              pressed && !isInSelectionMode ? localStyles.wordPressed : undefined,
              isAnchor ? localStyles.anchorWord : undefined,
            ]}
          >
            <Text
              style={[
                wordStyle,
                isActive && activeWordStyle,
                isSaved && savedWordStyle,
                isInSelection && localStyles.selectedText,
              ]}
            >
              {word}
              {idx < words.length - 1 ? ' ' : ''}
            </Text>
          </Pressable>
        );
      })}
      {(isInSelectionMode || hasCrossAnchorFromOtherSegment) && (
        <View style={localStyles.selectionHintWrap}>
          <View style={localStyles.selectionHintBubble}>
            <Text style={localStyles.selectionHintText}>
              {hasCrossAnchorFromOtherSegment ? 'Tap a word here to complete phrase' : 'Tap another word to select a phrase'}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

export const SelectableWords = React.memo(SelectableWordsInner);

const localStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
  },
  wordWrap: {
    borderRadius: 3,
  },
  wordPressed: {
    opacity: 0.6,
  },
  anchorWord: {
    borderRadius: 3,
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(249, 115, 22, 0.5)',
  },
  selectedText: {
    fontWeight: '700' as const,
  },
  selectionHintWrap: {
    width: '100%',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  selectionHintBubble: {
    backgroundColor: 'rgba(0,0,0,0.06)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
  },
  selectionHintText: {
    fontSize: 12,
    color: '#888',
    fontWeight: '500' as const,
  },
});
