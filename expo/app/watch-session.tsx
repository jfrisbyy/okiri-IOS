import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Animated,
  ActivityIndicator,
  Dimensions,
  Platform,
  StatusBar,
  PanResponder,
  LayoutChangeEvent,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useLocalSearchParams } from 'expo-router';
import { safeGoBack } from '@/utils/navigation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as Haptics from 'expo-haptics';
import { USE_NATIVE_DRIVER } from '@/constants/animation';
import {
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  BookOpen,
  Languages,
  RotateCcw,
  AlertCircle,
  RotateCw,
  Play,
  Pause,
  SkipBack,
  SkipForward,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { SelectableWords } from '@/components/SelectableWords';
import { WordDetailSheet } from '@/components/WordDetailSheet';
import { useApp } from '@/contexts/AppContext';
import { TranscriptSegment } from '@/types';
import { watchVideos } from '@/mocks/watchContent';
import { fetchYouTubeTranscript, translateTranscriptToFrench, fetchFrenchTranscriptForEnglishVideo } from '@/utils/youtubeSearch';
import type { TranscriptSource } from '@/utils/youtubeSearch';
import { logEncounter } from '@/utils/crossTabTracker';
import { recordWatchedVideo, updateWatchPosition } from '@/utils/watchHistory';
import { generateDubForVideo, DubPlaybackEngine } from '@/utils/dubbing';
import type { DubClip } from '@/utils/dubbing';

const AUTO_SCROLL_RESUME_DELAY = 5000;
const PLAYBACK_SPEEDS = [0.75, 1, 1.25] as const;
type PlaybackSpeed = (typeof PLAYBACK_SPEEDS)[number];
const CONTROLS_HIDE_DELAY = 3000;
const SNAP_RATIOS = [0.30, 0.55, 0.80] as const;
const DISMISS_RATIO = 0.15;
const MAX_PANEL_RATIO = 0.85;

interface SelectedWordInfo {
  word: string;
  context: string;
}

function findActiveSegmentIndex(segments: TranscriptSegment[], time: number): number {
  for (let i = segments.length - 1; i >= 0; i--) {
    if (time >= segments[i].start) {
      return i;
    }
  }
  return -1;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function useDimensions() {
  const [dims, setDims] = useState(() => Dimensions.get('window'));
  useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window }) => {
      setDims(window);
    });
    return () => sub?.remove();
  }, []);
  return dims;
}

function getEmbedUrl(videoId: string): string {
  return `https://www.youtube.com/embed/${videoId}?enablejsapi=1&playsinline=1&autoplay=1&controls=1&modestbranding=1&rel=0&iv_load_policy=3&cc_load_policy=0&fs=0&origin=https://www.youtube.com`;
}

const INJECTED_JS_BRIDGE = `
(function() {
  var pollId = null;
  var ready = false;
  function sendMsg(obj) {
    try { window.ReactNativeWebView.postMessage(JSON.stringify(obj)); } catch(e) {}
  }
  function trySetup() {
    var p = document.getElementById('movie_player');
    if (p && typeof p.getPlayerState === 'function') {
      if (!ready) {
        ready = true;
        sendMsg({ type: 'ready', duration: p.getDuration() || 0 });
      }
      if (pollId) clearInterval(pollId);
      pollId = setInterval(function() {
        try {
          var state = p.getPlayerState();
          sendMsg({
            type: 'time',
            current: p.getCurrentTime(),
            duration: p.getDuration(),
            state: state
          });
        } catch(e) {}
      }, 250);
    }
  }
  var findInterval = setInterval(function() {
    trySetup();
    if (ready) clearInterval(findInterval);
  }, 300);
  function handleCmd(data) {
    var p = document.getElementById('movie_player');
    if (!p || typeof p.playVideo !== 'function') return;
    switch(data.action) {
      case 'play': p.playVideo(); break;
      case 'pause': p.pauseVideo(); break;
      case 'seek': p.seekTo(data.time, true); break;
      case 'setRate': p.setPlaybackRate(data.rate); break;
      case 'setVolume': p.setVolume(data.volume); break;
    }
  }
  window.addEventListener('message', function(e) {
    try { handleCmd(typeof e.data === 'string' ? JSON.parse(e.data) : e.data); } catch(e) {}
  });
  document.addEventListener('message', function(e) {
    try { handleCmd(typeof e.data === 'string' ? JSON.parse(e.data) : e.data); } catch(e) {}
  });
})();
true;
`;

export default function WatchSessionScreen() {
  const { videoId, title, channel: _channel, nativeMode, channelId: _channelId, categoryId: _categoryId, thumbnailUrl: _thumbnailUrl } = useLocalSearchParams<{
    videoId: string;
    title?: string;
    channel?: string;
    nativeMode?: string;
    channelId?: string;
    categoryId?: string;
    thumbnailUrl?: string;
  }>();
  const { addGap } = useApp();
  const insets = useSafeAreaInsets();
  const { width: screenW, height: screenH } = useDimensions();

  const isLandscape = screenW > screenH;

  const [transcript, setTranscript] = useState<TranscriptSegment[]>([]);
  const [isLoadingTranscript, setIsLoadingTranscript] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeSegmentIndex, setActiveSegmentIndex] = useState(-1);
  const [currentTime, setCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [savedWords, setSavedWords] = useState<Set<string>>(new Set());
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [isTranslatingTranscript, setIsTranslatingTranscript] = useState(false);
  const [wasPlayingBeforePause, setWasPlayingBeforePause] = useState(false);
  const [transcriptError, setTranscriptError] = useState<string | boolean>(false);
  const [loadingMethod, setLoadingMethod] = useState<string>('');
  const [transcriptSource, setTranscriptSource] = useState<TranscriptSource | null>(null);
  const [translationProgress, setTranslationProgress] = useState<{ translated: number; total: number } | null>(null);
  const [playbackSpeed, setPlaybackSpeed] = useState<PlaybackSpeed>(1);
  const [showFollowPill, setShowFollowPill] = useState(false);
  const [tappedSegmentIndex, setTappedSegmentIndex] = useState<number | null>(null);
  const [selectedWord, setSelectedWord] = useState<SelectedWordInfo | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [crossSegmentAnchor, setCrossSegmentAnchor] = useState<{ segmentIndex: number; wordIndex: number } | null>(null);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [prevSubtitleText, setPrevSubtitleText] = useState<string | null>(null);
  const [scrubberWidth, setScrubberWidth] = useState(0);

  const [audioMode, setAudioMode] = useState<'original' | 'french_dub'>('original');
  const [dubStatus, setDubStatus] = useState<'idle' | 'generating' | 'ready' | 'error'>('idle');
  const [dubProgress, setDubProgress] = useState<{ ready: number; total: number }>({ ready: 0, total: 0 });
  const [_dubClips, setDubClips] = useState<DubClip[]>([]);
  const dubEngineRef = useRef<DubPlaybackEngine | null>(null);
  const dubGenerationRef = useRef<boolean>(false);

  const isNativeMode = nativeMode === '1';
  const positionUpdateRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasRecordedRef = useRef(false);
  const currentTimeRef = useRef(0);
  const isWordDetailOpen = selectedWord !== null;
  const crossSegmentAnchorRef = useRef<{ segmentIndex: number; wordIndex: number } | null>(null);

  const webViewRef = useRef<WebView>(null);
  const flatListRef = useRef<FlatList>(null);
  const tapFlashAnim = useRef(new Animated.Value(0)).current;
  const panelTranslateYAnim = useRef(new Animated.Value(
    Math.round(Dimensions.get('window').height * MAX_PANEL_RATIO)
  )).current;
  const subtitleOpacity = useRef(new Animated.Value(1)).current;
  const subtitleFadeAnim = useRef(new Animated.Value(1)).current;
  const controlsFadeAnim = useRef(new Animated.Value(1)).current;
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const userScrollingRef = useRef(false);
  const userScrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevActiveIndexRef = useRef(-1);
  const isPlayingRef = useRef(false);
  const isPanelOpenRef = useRef(false);
  const panelTranslateYValueRef = useRef(Math.round(Dimensions.get('window').height * MAX_PANEL_RATIO));
  const dragStartYRef = useRef(0);

  const video = useMemo(
    () => watchVideos.find((v) => v.youtubeId === videoId) ?? null,
    [videoId]
  );

  const maxPanelH = Math.round(screenH * MAX_PANEL_RATIO);
  const snapTranslateYs = useMemo(() => SNAP_RATIOS.map(r => maxPanelH - Math.round(screenH * r)), [maxPanelH, screenH]);
  const dismissTranslateY = maxPanelH - Math.round(screenH * DISMISS_RATIO);

  const embedUrl = useMemo(() => (videoId ? getEmbedUrl(videoId) : ''), [videoId]);

  useEffect(() => {
    isPanelOpenRef.current = isPanelOpen;
  }, [isPanelOpen]);

  useEffect(() => {
    if (!isPanelOpenRef.current) {
      panelTranslateYAnim.setValue(maxPanelH);
      panelTranslateYValueRef.current = maxPanelH;
    }
  }, [maxPanelH, panelTranslateYAnim]);

  useEffect(() => {
    const listenerId = panelTranslateYAnim.addListener(({ value }) => {
      panelTranslateYValueRef.current = value;
    });
    return () => panelTranslateYAnim.removeListener(listenerId);
  }, [panelTranslateYAnim]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    crossSegmentAnchorRef.current = crossSegmentAnchor;
  }, [crossSegmentAnchor]);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      ScreenOrientation.unlockAsync().catch(() => {});
    }
    return () => {
      if (Platform.OS !== 'web') {
        ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
      }
    };
  }, []);

  useEffect(() => {
    if (!videoId || hasRecordedRef.current) return;
    hasRecordedRef.current = true;
    const decodedTitle = title ? decodeURIComponent(title) : video?.title ?? '';
    const decodedChannel = _channel ? decodeURIComponent(_channel) : video?.channel ?? '';
    const decodedThumb = _thumbnailUrl ? decodeURIComponent(_thumbnailUrl) : `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
    void recordWatchedVideo({
      videoId,
      title: decodedTitle,
      channelId: _channelId ?? '',
      channelTitle: decodedChannel,
      categoryId: _categoryId ?? '',
      thumbnailUrl: decodedThumb,
      duration: 0,
      timestamp: Date.now(),
    });
    console.log('[Watch] Recorded watch history for:', videoId);
  }, [videoId, title, _channel, _channelId, _categoryId, _thumbnailUrl, video]);

  useEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);

  useEffect(() => {
    if (!videoId || videoDuration <= 0) return;
    void updateWatchPosition(videoId, currentTimeRef.current);
  }, [videoId, videoDuration]);

  useEffect(() => {
    if (!videoId) return;
    positionUpdateRef.current = setInterval(() => {
      if (currentTimeRef.current > 0) {
        void updateWatchPosition(videoId, currentTimeRef.current);
      }
    }, 15000);
    return () => {
      if (positionUpdateRef.current) {
        clearInterval(positionUpdateRef.current);
      }
      if (currentTimeRef.current > 0) {
        void updateWatchPosition(videoId, currentTimeRef.current);
      }
    };
  }, [videoId]);

  const sendCommand = useCallback((cmd: Record<string, unknown>) => {
    if (webViewRef.current) {
      const action = cmd.action as string;
      let js = '';
      if (action === 'play') {
        js = `(function(){ var p=document.getElementById('movie_player'); if(p&&p.playVideo) p.playVideo(); })(); true;`;
      } else if (action === 'pause') {
        js = `(function(){ var p=document.getElementById('movie_player'); if(p&&p.pauseVideo) p.pauseVideo(); })(); true;`;
      } else if (action === 'seek') {
        js = `(function(){ var p=document.getElementById('movie_player'); if(p&&p.seekTo) p.seekTo(${Number(cmd.time)}, true); })(); true;`;
      } else if (action === 'setRate') {
        js = `(function(){ var p=document.getElementById('movie_player'); if(p&&p.setPlaybackRate) p.setPlaybackRate(${Number(cmd.rate)}); })(); true;`;
      } else if (action === 'setVolume') {
        js = `(function(){ var p=document.getElementById('movie_player'); if(p&&p.setVolume) p.setVolume(${Number(cmd.volume)}); })(); true;`;
      }
      if (js) webViewRef.current.injectJavaScript(js);
    }
  }, []);

  const resetControlsTimer = useCallback(() => {
    if (controlsTimerRef.current) {
      clearTimeout(controlsTimerRef.current);
    }
    setControlsVisible(true);
    Animated.timing(controlsFadeAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();

    controlsTimerRef.current = setTimeout(() => {
      if (isPlayingRef.current && !isPanelOpenRef.current) {
        Animated.timing(controlsFadeAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: USE_NATIVE_DRIVER,
        }).start(() => {
          setControlsVisible(false);
        });
      }
    }, CONTROLS_HIDE_DELAY);
  }, [controlsFadeAnim]);

  useEffect(() => {
    if (isPlaying && !isPanelOpen) {
      resetControlsTimer();
    } else {
      if (controlsTimerRef.current) {
        clearTimeout(controlsTimerRef.current);
      }
      setControlsVisible(true);
      Animated.timing(controlsFadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: USE_NATIVE_DRIVER,
      }).start();
    }
  }, [isPlaying, isPanelOpen, resetControlsTimer, controlsFadeAnim]);

  const handleScreenTap = useCallback(() => {
    if (isPanelOpenRef.current) return;
    if (controlsVisible) {
      if (controlsTimerRef.current) {
        clearTimeout(controlsTimerRef.current);
      }
      Animated.timing(controlsFadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: USE_NATIVE_DRIVER,
      }).start(() => {
        setControlsVisible(false);
      });
    } else {
      setControlsVisible(true);
      Animated.timing(controlsFadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: USE_NATIVE_DRIVER,
      }).start();
      resetControlsTimer();
    }
  }, [resetControlsTimer, controlsVisible, controlsFadeAnim]);

  const handlePlayPause = useCallback(() => {
    if (isPlayingRef.current) {
      sendCommand({ action: 'pause' });
    } else {
      sendCommand({ action: 'play' });
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    resetControlsTimer();
  }, [resetControlsTimer, sendCommand]);

  const handleRewind = useCallback(() => {
    const newTime = Math.max(0, currentTime - 5);
    sendCommand({ action: 'seek', time: newTime });
    setCurrentTime(newTime);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    resetControlsTimer();
    console.log('[Watch] Rewind 5s to', newTime);
  }, [currentTime, sendCommand, resetControlsTimer]);

  const handleForward = useCallback(() => {
    const newTime = currentTime + 5;
    sendCommand({ action: 'seek', time: newTime });
    setCurrentTime(newTime);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    resetControlsTimer();
    console.log('[Watch] Forward 5s to', newTime);
  }, [currentTime, sendCommand, resetControlsTimer]);

  const handleMethodChange = useCallback((method: string, step: number, total: number) => {
    setLoadingMethod(`${method} (${step}/${total})`);
  }, []);

  const handleProgressiveUpdate = useCallback((translated: number, total: number, partialSegments: TranscriptSegment[]) => {
    setTranslationProgress({ translated, total });
    setTranscript(partialSegments);
    if (translated > 0 && translated < total) {
      setIsLoadingTranscript(false);
      setIsTranslatingTranscript(true);
    }
  }, []);

  useEffect(() => {
    if (!videoId) return;

    setIsLoadingTranscript(true);
    setIsTranslatingTranscript(false);
    setTranscriptError(false);
    setLoadingMethod('');
    setTranscriptSource(null);
    setTranslationProgress(null);

    const loadTranscript = async () => {
      try {
        if (isNativeMode) {
          console.log('[Watch] Native mode: fetching original language transcript via Supadata');
          setLoadingMethod('Fetching transcript...');
          const segments = await fetchYouTubeTranscript(videoId, true, handleMethodChange);
          if (segments.length > 0) {
            console.log(`[Watch] Loaded ${segments.length} original transcript segments`);
            setTranscript(segments);
            setIsLoadingTranscript(false);
            setIsTranslatingTranscript(true);
            try {
              const translated = await translateTranscriptToFrench(segments);
              setTranscript(translated);
              console.log('[Watch] Transcript translation complete');
            } catch (err) {
              console.error('[Watch] Translation failed, keeping original:', err);
            }
            setIsTranslatingTranscript(false);
          } else {
            console.log('[Watch] No transcript available for this video (native mode)');
            setTranscript([]);
            setIsLoadingTranscript(false);
          }
        } else {
          console.log('[Watch] Learn with Subtitles mode: using waterfall for:', videoId);
          setLoadingMethod('Preparing French subtitles...');
          const result = await fetchFrenchTranscriptForEnglishVideo(
            videoId,
            handleMethodChange,
            handleProgressiveUpdate,
          );
          setTranscriptSource(result.transcriptSource);
          if (result.segments.length > 0) {
            console.log(`[Watch] Loaded ${result.segments.length} segments via ${result.transcriptSource}`);
            setTranscript(result.segments);
          } else {
            console.log('[Watch] No transcript available for this video (subtitle mode)');
            setTranscript([]);
          }
          setIsLoadingTranscript(false);
          setIsTranslatingTranscript(false);
          setTranslationProgress(null);
        }
      } catch (error) {
        console.error('[Watch] Transcript load failed:', error);
        setTranscript([]);
        setTranscriptError(true);
        setIsLoadingTranscript(false);
        setIsTranslatingTranscript(false);
        setTranslationProgress(null);
      }
    };

    void loadTranscript();
  }, [videoId, isNativeMode, handleMethodChange, handleProgressiveUpdate]);

  const handleWebViewMessage = useCallback((event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      switch (data.type) {
        case 'ready':
          console.log('[Watch] YouTube IFrame Player ready, duration:', data.duration);
          setIsPlayerReady(true);
          if (typeof data.duration === 'number' && data.duration > 0) {
            setVideoDuration(data.duration);
          }
          break;
        case 'state':
          console.log(`[Watch] Player state: ${data.state}`);
          if (data.state === 'playing') {
            setIsPlaying(true);
          } else if (data.state === 'paused' || data.state === 'ended') {
            setIsPlaying(false);
          }
          break;
        case 'time':
          if (typeof data.current === 'number' && !isNaN(data.current)) {
            setCurrentTime(data.current);
            if (dubEngineRef.current) {
              void dubEngineRef.current.syncToTimestamp(data.current);
            }
          }
          if (typeof data.duration === 'number' && data.duration > 0) {
            setVideoDuration(data.duration);
          }
          if (data.state === 1) setIsPlaying(true);
          else if (data.state === 2 || data.state === 0) setIsPlaying(false);
          break;
        case 'error':
          console.log('[Watch] Player error code:', data.code);
          break;
      }
    } catch {
      console.log('[Watch] WebView message parse error');
    }
  }, []);

  useEffect(() => {
    if (transcript.length === 0) return;
    const newIndex = findActiveSegmentIndex(transcript, currentTime);
    setActiveSegmentIndex((prev) => (prev !== newIndex ? newIndex : prev));
  }, [currentTime, transcript]);

  const activeSubtitleText =
    activeSegmentIndex >= 0 && activeSegmentIndex < transcript.length
      ? transcript[activeSegmentIndex].text
      : null;

  useEffect(() => {
    if (activeSubtitleText !== prevSubtitleText) {
      Animated.sequence([
        Animated.timing(subtitleFadeAnim, {
          toValue: 0,
          duration: 120,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(subtitleFadeAnim, {
          toValue: 1,
          duration: 180,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ]).start();
      setPrevSubtitleText(activeSubtitleText);
    }
  }, [activeSubtitleText, prevSubtitleText, subtitleFadeAnim]);

  useEffect(() => {
    if (!isPanelOpenRef.current) return;
    if (activeSegmentIndex < 0 || transcript.length === 0) return;
    if (userScrollingRef.current) return;
    if (prevActiveIndexRef.current === activeSegmentIndex) return;
    prevActiveIndexRef.current = activeSegmentIndex;

    if (flatListRef.current) {
      try {
        flatListRef.current.scrollToIndex({
          index: activeSegmentIndex,
          animated: true,
          viewPosition: 0.25,
        });
      } catch {
        console.log('[Watch] Auto-scroll failed');
      }
    }
  }, [activeSegmentIndex, transcript.length]);

  const snapPanelTo = useCallback((translateY: number) => {
    Animated.spring(panelTranslateYAnim, {
      toValue: translateY,
      useNativeDriver: false,
      tension: 80,
      friction: 12,
    }).start();
    const isOpen = translateY < maxPanelH;
    setIsPanelOpen(isOpen);
    isPanelOpenRef.current = isOpen;
    Animated.timing(subtitleOpacity, {
      toValue: isOpen ? 0 : 1,
      duration: 200,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  }, [panelTranslateYAnim, maxPanelH, subtitleOpacity]);

  const collapsePanel = useCallback(() => {
    snapPanelTo(maxPanelH);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    console.log('[Watch] Panel collapsed');
  }, [snapPanelTo, maxPanelH]);

  const openPanel = useCallback(() => {
    const targetY = snapTranslateYs[0];
    snapPanelTo(targetY);
    prevActiveIndexRef.current = -1;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    console.log('[Watch] Panel opened');
  }, [snapPanelTo, snapTranslateYs]);

  const handlePanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 5,
        onPanResponderGrant: () => {
          dragStartYRef.current = panelTranslateYValueRef.current;
        },
        onPanResponderMove: (_, gs) => {
          const newY = Math.max(0, Math.min(maxPanelH, dragStartYRef.current + gs.dy));
          panelTranslateYAnim.setValue(newY);
        },
        onPanResponderRelease: () => {
          const currentY = panelTranslateYValueRef.current;
          if (currentY > dismissTranslateY) {
            collapsePanel();
            return;
          }
          let nearestSnap = snapTranslateYs[0];
          let minDist = Math.abs(currentY - nearestSnap);
          for (const snap of snapTranslateYs) {
            const dist = Math.abs(currentY - snap);
            if (dist < minDist) {
              minDist = dist;
              nearestSnap = snap;
            }
          }
          snapPanelTo(nearestSnap);
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        },
      }),
    [maxPanelH, dismissTranslateY, snapTranslateYs, panelTranslateYAnim, collapsePanel, snapPanelTo]
  );

  const seekToSegment = useCallback(
    (segment: TranscriptSegment, index: number) => {
      sendCommand({ action: 'seek', time: segment.start });
      setCurrentTime(segment.start);
      setActiveSegmentIndex(index);
      prevActiveIndexRef.current = -1;
      userScrollingRef.current = false;
      setShowFollowPill(false);

      setTappedSegmentIndex(index);
      Animated.sequence([
        Animated.timing(tapFlashAnim, {
          toValue: 1,
          duration: 100,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(tapFlashAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ]).start(() => {
        setTappedSegmentIndex(null);
      });

      if (!isPlayingRef.current) {
        sendCommand({ action: 'play' });
        setIsPlaying(true);
      }
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [tapFlashAnim, sendCommand]
  );

  const replaySegment = useCallback(() => {
    if (activeSegmentIndex < 0 || !transcript[activeSegmentIndex]) return;
    const seg = transcript[activeSegmentIndex];
    sendCommand({ action: 'seek', time: seg.start });
    setCurrentTime(seg.start);
    if (!isPlayingRef.current) {
      sendCommand({ action: 'play' });
      setIsPlaying(true);
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    console.log('[Watch] Replaying segment:', activeSegmentIndex);
  }, [activeSegmentIndex, transcript, sendCommand]);

  const openWordDetail = useCallback((word: string, segmentText: string) => {
    const cleanWord = word.replace(/[.,;:!?'"()«»\-…\d]/g, '').trim();
    if (!cleanWord || cleanWord.length < 2) return;

    if (isPlayingRef.current) {
      setWasPlayingBeforePause(true);
      sendCommand({ action: 'pause' });
      setIsPlaying(false);
      console.log('[Watch] Auto-paused for word selection');
    } else {
      setWasPlayingBeforePause(false);
    }

    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedWord({ word: cleanWord, context: segmentText });
    console.log('[Watch] Opened word detail for:', cleanWord);
  }, [sendCommand]);

  const handleSelectionStart = useCallback(() => {
    if (isPlayingRef.current) {
      setWasPlayingBeforePause(true);
      sendCommand({ action: 'pause' });
      setIsPlaying(false);
      console.log('[Watch] Auto-paused for phrase selection (long press)');
    } else {
      setWasPlayingBeforePause(false);
    }
  }, [sendCommand]);

  const handleCrossSegmentAnchor = useCallback((segIdx: number, wordIdx: number) => {
    console.log('[Watch] Cross-segment anchor set at seg:', segIdx, 'word:', wordIdx);
    setCrossSegmentAnchor({ segmentIndex: segIdx, wordIndex: wordIdx });
  }, []);

  const openPhraseDetail = useCallback((phrase: string, segmentText: string) => {
    const cleanPhrase = phrase.replace(/[.,;:!?'"()«»…]/g, '').trim();
    if (!cleanPhrase || cleanPhrase.length < 2) return;

    if (isPlayingRef.current) {
      setWasPlayingBeforePause(true);
      sendCommand({ action: 'pause' });
      setIsPlaying(false);
      console.log('[Watch] Auto-paused for phrase selection');
    } else {
      setWasPlayingBeforePause(false);
    }

    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedWord({ word: cleanPhrase, context: segmentText });
    console.log('[Watch] Opened phrase detail for:', cleanPhrase);
  }, [sendCommand]);

  const handleCrossSegmentTap = useCallback((tapSegIdx: number, tapWordIdx: number) => {
    const anchor = crossSegmentAnchorRef.current;
    if (!anchor) return;

    const startSeg = Math.min(anchor.segmentIndex, tapSegIdx);
    const endSeg = Math.max(anchor.segmentIndex, tapSegIdx);

    const phraseWords: string[] = [];
    for (let s = startSeg; s <= endSeg; s++) {
      if (!transcript[s]) continue;
      const segWords = transcript[s].text.split(/\s+/).filter((w) => w.length > 0);
      if (s === startSeg && s === endSeg) {
        const sWord = anchor.segmentIndex === startSeg ? anchor.wordIndex : tapWordIdx;
        const eWord = anchor.segmentIndex === startSeg ? tapWordIdx : anchor.wordIndex;
        const from = Math.min(sWord, eWord);
        const to = Math.max(sWord, eWord);
        phraseWords.push(...segWords.slice(from, to + 1));
      } else if (s === startSeg) {
        const fromWord = anchor.segmentIndex === startSeg ? anchor.wordIndex : 0;
        phraseWords.push(...segWords.slice(fromWord));
      } else if (s === endSeg) {
        const toWord = anchor.segmentIndex === endSeg ? anchor.wordIndex : tapWordIdx;
        phraseWords.push(...segWords.slice(0, toWord + 1));
      } else {
        phraseWords.push(...segWords);
      }
    }

    const phrase = phraseWords.join(' ');
    const context = transcript.slice(startSeg, endSeg + 1).map(seg => seg.text).join(' ');
    console.log('[Watch] Cross-segment phrase selected:', phrase);
    setCrossSegmentAnchor(null);

    if (phrase.split(/\s+/).length <= 1) {
      openWordDetail(phrase, context);
    } else {
      openPhraseDetail(phrase, context);
    }
  }, [transcript, openWordDetail, openPhraseDetail]);

  const handleAddToGaps = useCallback(
    async (
      word: string,
      detail: { definition: string; exampleFrench: string; exampleEnglish: string; phonetic: string }
    ) => {
      try {
        await addGap(
          word,
          detail.definition,
          '',
          detail.exampleFrench,
          detail.exampleEnglish,
          'listening',
          videoId,
          detail.phonetic,
          undefined,
          'vocab'
        );
        setSavedWords((prev) => new Set(prev).add(word.toLowerCase()));
        void logEncounter(word, selectedWord?.context ?? '', 'watch', videoId ?? '');
        console.log('[Watch] Gap added via detail sheet:', word);
      } catch (error) {
        console.error('[Watch] Failed to add gap:', error);
      }
    },
    [videoId, addGap, selectedWord]
  );

  const handleDismissWordDetail = useCallback(() => {
    setSelectedWord(null);
    setCrossSegmentAnchor(null);
    if (wasPlayingBeforePause) {
      sendCommand({ action: 'play' });
      setIsPlaying(true);
      setWasPlayingBeforePause(false);
      console.log('[Watch] Resuming playback after word detail dismiss');
    }
  }, [wasPlayingBeforePause, sendCommand]);

  const handleUserScrollBegin = useCallback(() => {
    userScrollingRef.current = true;
    setShowFollowPill(true);
    if (userScrollTimerRef.current) {
      clearTimeout(userScrollTimerRef.current);
    }
  }, []);

  const handleUserScrollEnd = useCallback(() => {
    if (userScrollTimerRef.current) {
      clearTimeout(userScrollTimerRef.current);
    }
    userScrollTimerRef.current = setTimeout(() => {
      userScrollingRef.current = false;
      setShowFollowPill(false);
      prevActiveIndexRef.current = -1;
    }, AUTO_SCROLL_RESUME_DELAY);
  }, []);

  const handleFollowAlongPress = useCallback(() => {
    userScrollingRef.current = false;
    setShowFollowPill(false);
    prevActiveIndexRef.current = -1;
    if (userScrollTimerRef.current) {
      clearTimeout(userScrollTimerRef.current);
    }
    if (activeSegmentIndex >= 0 && flatListRef.current) {
      try {
        flatListRef.current.scrollToIndex({
          index: activeSegmentIndex,
          animated: true,
          viewPosition: 0.25,
        });
      } catch {
        console.log('[Watch] Follow along scroll failed');
      }
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [activeSegmentIndex]);

  const cyclePlaybackSpeed = useCallback(() => {
    setPlaybackSpeed((prev) => {
      const idx = PLAYBACK_SPEEDS.indexOf(prev);
      const next = PLAYBACK_SPEEDS[(idx + 1) % PLAYBACK_SPEEDS.length];
      console.log(`[Watch] Speed changed: ${prev}x → ${next}x`);
      sendCommand({ action: 'setRate', rate: next });
      return next;
    });
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    resetControlsTimer();
  }, [resetControlsTimer, sendCommand]);

  useEffect(() => {
    if (isPlayerReady) {
      sendCommand({ action: 'setRate', rate: playbackSpeed });
    }
  }, [isPlayerReady, playbackSpeed, sendCommand]);

  useEffect(() => {
    if (isNativeMode) return;
    if (dubGenerationRef.current) return;
    if (isLoadingTranscript || isTranslatingTranscript) return;
    if (transcript.length === 0) return;
    if (dubStatus !== 'idle') return;

    dubGenerationRef.current = true;
    setDubStatus('generating');
    setDubProgress({ ready: 0, total: transcript.length });
    console.log('[Watch] Starting dub generation for', transcript.length, 'segments');

    const segments = transcript.map(s => ({ text: s.text, start: s.start, duration: s.duration }));
    generateDubForVideo(videoId ?? '', segments, (readyCount, totalCount) => {
      setDubProgress({ ready: readyCount, total: totalCount });
    }).then((clips) => {
      if (clips.length > 0) {
        setDubClips(clips);
        const engine = new DubPlaybackEngine(clips);
        dubEngineRef.current = engine;
        setDubStatus('ready');
        console.log(`[Watch] Dub ready: ${clips.length} clips`);
      } else {
        setDubStatus('error');
        console.warn('[Watch] Dub generation returned 0 clips');
      }
    }).catch((err) => {
      setDubStatus('error');
      console.error('[Watch] Dub generation failed:', err);
    });
  }, [isNativeMode, isLoadingTranscript, isTranslatingTranscript, transcript, dubStatus, videoId]);

  useEffect(() => {
    return () => {
      if (dubEngineRef.current) {
        void dubEngineRef.current.dispose();
        dubEngineRef.current = null;
      }
    };
  }, []);

  const toggleAudioMode = useCallback(() => {
    if (dubStatus !== 'ready' || !dubEngineRef.current) return;
    const newMode = audioMode === 'original' ? 'french_dub' : 'original';
    setAudioMode(newMode);
    dubEngineRef.current.setMode(newMode);
    if (newMode === 'french_dub') {
      sendCommand({ action: 'setVolume', volume: 15 });
      console.log('[Watch] Audio mode: FR dub (volume ducked to 15)');
    } else {
      sendCommand({ action: 'setVolume', volume: 100 });
      console.log('[Watch] Audio mode: original (volume restored to 100)');
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [dubStatus, audioMode, sendCommand]);

  const handleScrubberPress = useCallback((evt: any) => {
    if (scrubberWidth <= 0 || videoDuration <= 0) return;
    const locationX = evt.nativeEvent?.locationX ?? 0;
    const ratio = Math.max(0, Math.min(1, locationX / scrubberWidth));
    const targetTime = ratio * videoDuration;
    sendCommand({ action: 'seek', time: targetTime });
    setCurrentTime(targetTime);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    resetControlsTimer();
    console.log('[Watch] Scrubber seek to', targetTime.toFixed(1));
  }, [scrubberWidth, videoDuration, sendCommand, resetControlsTimer]);

  const handleScrubberLayout = useCallback((e: LayoutChangeEvent) => {
    setScrubberWidth(e.nativeEvent.layout.width);
  }, []);

  const onScrollToIndexFailed = useCallback(
    (info: { index: number; highestMeasuredFrameIndex: number; averageItemLength: number }) => {
      setTimeout(() => {
        if (flatListRef.current) {
          const safeIndex = Math.min(info.index, info.highestMeasuredFrameIndex);
          flatListRef.current.scrollToIndex({
            index: Math.max(0, safeIndex),
            animated: true,
            viewPosition: 0.25,
          });
        }
      }, 200);
    },
    []
  );

  const keyExtractor = useCallback((item: TranscriptSegment) => item.id, []);

  const renderSegment = useCallback(
    ({ item, index }: { item: TranscriptSegment; index: number }) => {
      const isActive = index === activeSegmentIndex;
      const isTapped = index === tappedSegmentIndex;

      return (
        <Pressable
          onPress={() => seekToSegment(item, index)}
          style={[
            styles.segmentRow,
            isActive && styles.segmentRowActive,
            isTapped && styles.segmentRowTapped,
          ]}
          testID={`segment-${index}`}
        >
          <View style={styles.segmentTimeCol}>
            <Text style={[styles.segmentTime, isActive && styles.segmentTimeActive]}>
              {formatTime(item.start)}
            </Text>
            {isActive && (
              <Pressable
                onPress={(e) => {
                  e.stopPropagation?.();
                  replaySegment();
                }}
                style={styles.replayBtn}
                hitSlop={8}
                testID="replay-segment-btn"
              >
                <RotateCw size={12} color={Colors.primary} />
              </Pressable>
            )}
          </View>
          <View style={styles.segmentTextCol} onStartShouldSetResponder={() => true}>
            <SelectableWords
              text={item.text}
              isActive={isActive}
              savedWords={savedWords}
              onWordTap={openWordDetail}
              onPhraseSelected={openPhraseDetail}
              onSelectionStart={handleSelectionStart}
              segmentIndex={index}
              crossSegmentAnchor={crossSegmentAnchor}
              onCrossSegmentAnchor={handleCrossSegmentAnchor}
              onCrossSegmentTap={handleCrossSegmentTap}
              wordStyle={styles.word}
              activeWordStyle={styles.wordActive}
              savedWordStyle={styles.wordSaved}
              containerStyle={styles.segmentTextColInner}
            />
          </View>
        </Pressable>
      );
    },
    [
      activeSegmentIndex,
      savedWords,
      openWordDetail,
      openPhraseDetail,
      seekToSegment,
      replaySegment,
      tappedSegmentIndex,
      handleSelectionStart,
      handleCrossSegmentAnchor,
      crossSegmentAnchor,
      handleCrossSegmentTap,
    ]
  );

  const speedLabel = useMemo(() => {
    if (playbackSpeed === 1) return '1x';
    if (playbackSpeed === 0.75) return '¾x';
    return '1¼x';
  }, [playbackSpeed]);

  const progressRatio = videoDuration > 0 ? currentTime / videoDuration : 0;

  if (!videoId) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>No video selected</Text>
        <Pressable onPress={() => safeGoBack()} style={styles.errorButton}>
          <Text style={styles.errorButtonText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const subtitleBottomOffset = isLandscape
    ? Math.max(insets.bottom, 20) + 24
    : insets.bottom + 80;


  const showSubtitleOverlay = !isPanelOpen && !isWordDetailOpen;
  const showCustomControls = !isWordDetailOpen;

  return (
    <View style={styles.container}>
      <StatusBar hidden />

      <View style={[styles.videoFull, { width: screenW, height: screenH }]}>
        <WebView
          ref={webViewRef}
          source={{ uri: embedUrl }}
          style={{ flex: 1, backgroundColor: '#000' }}
          injectedJavaScript={INJECTED_JS_BRIDGE}
          onMessage={handleWebViewMessage}
          javaScriptEnabled
          domStorageEnabled
          mediaPlaybackRequiresUserAction={false}
          allowsInlineMediaPlayback
          allowsFullscreenVideo={false}
          scrollEnabled={false}
          bounces={false}
          originWhitelist={['*']}
          mixedContentMode="always"
          userAgent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
        />
      </View>

      {showCustomControls && !controlsVisible && !isPanelOpen && (
        <Pressable
          style={[styles.tapOverlay, { width: screenW, height: screenH }]}
          onPress={handleScreenTap}
          testID="video-tap-area"
        />
      )}

      {showCustomControls && controlsVisible && !isPanelOpen && (
        <Pressable
          style={[styles.controlsOverlay, { width: screenW, height: screenH }]}
          onPress={handleScreenTap}
          testID="controls-tap-area"
        >
          <Animated.View
            style={[
              styles.controlsCenter,
              { opacity: controlsFadeAnim },
            ]}
            pointerEvents="box-none"
          >
            <Pressable
              onPress={(e) => {
                e.stopPropagation?.();
                handleRewind();
              }}
              style={styles.controlBtn}
              hitSlop={12}
              testID="rewind-btn"
            >
              <SkipBack size={22} color="#fff" fill="#fff" />
              <Text style={styles.controlBtnLabel}>5</Text>
            </Pressable>
            <Pressable
              onPress={(e) => {
                e.stopPropagation?.();
                handlePlayPause();
              }}
              style={styles.controlBtnMain}
              hitSlop={12}
              testID="play-pause-btn"
            >
              {isPlaying ? (
                <Pause size={30} color="#fff" fill="#fff" />
              ) : (
                <Play size={30} color="#fff" fill="#fff" style={{ marginLeft: 3 }} />
              )}
            </Pressable>
            <Pressable
              onPress={(e) => {
                e.stopPropagation?.();
                handleForward();
              }}
              style={styles.controlBtn}
              hitSlop={12}
              testID="forward-btn"
            >
              <SkipForward size={22} color="#fff" fill="#fff" />
              <Text style={styles.controlBtnLabel}>5</Text>
            </Pressable>
          </Animated.View>
        </Pressable>
      )}

      {showCustomControls && (
        <Animated.View
          style={[
            styles.topBar,
            {
              paddingTop: isLandscape ? Math.max(insets.top, 8) : insets.top + 8,
              paddingLeft: isLandscape ? Math.max(insets.left, 16) : 16,
              paddingRight: isLandscape ? Math.max(insets.right, 16) : 16,
              opacity: controlsFadeAnim,
            },
          ]}
          pointerEvents={controlsVisible ? 'box-none' : 'none'}
        >
          <Pressable
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              safeGoBack();
            }}
            style={styles.topBarBtn}
            hitSlop={12}
            testID="back-btn"
          >
            <ChevronLeft size={22} color="#fff" />
          </Pressable>

          <View style={styles.topBarRight}>
            {isTranslatingTranscript && (
              <View style={styles.translatingBadge}>
                <Languages size={12} color={Colors.primary} />
                <Text style={styles.translatingText}>
                  {translationProgress
                    ? `Translating ${translationProgress.translated}/${translationProgress.total}...`
                    : 'Translating...'}
                </Text>
              </View>
            )}
            {transcriptSource && !isTranslatingTranscript && (
              <View style={styles.sourceBadge}>
                <Text style={styles.sourceBadgeText}>
                  {transcriptSource === 'native_french' ? 'FR'
                    : transcriptSource === 'youtube_auto_translate' ? 'Auto'
                    : 'AI'}
                </Text>
              </View>
            )}
            {savedWords.size > 0 && (
              <View style={styles.gapBadge}>
                <BookOpen size={12} color={Colors.secondary} />
                <Text style={styles.gapBadgeText}>{savedWords.size}</Text>
              </View>
            )}
            <Pressable
              onPress={cyclePlaybackSpeed}
              style={styles.speedBadge}
              hitSlop={8}
              testID="speed-control"
            >
              <Text style={styles.speedBadgeText}>{speedLabel}</Text>
            </Pressable>
          </View>
        </Animated.View>
      )}

      {showCustomControls && controlsVisible && !isPanelOpen && videoDuration > 0 && (
        <Animated.View
          style={[
            styles.scrubberContainer,
            {
              bottom: subtitleBottomOffset + 40,
              left: isLandscape ? Math.max(insets.left, 20) + 20 : 20,
              right: isLandscape ? Math.max(insets.right, 20) + 20 : 20,
              opacity: controlsFadeAnim,
            },
          ]}
          pointerEvents="box-none"
        >
          <Text style={styles.scrubberTime}>{formatTime(currentTime)}</Text>
          <Pressable
            style={styles.scrubberTrack}
            onPress={handleScrubberPress}
            onLayout={handleScrubberLayout}
            testID="video-scrubber"
          >
            <View style={styles.scrubberBg} />
            <View
              style={[
                styles.scrubberFill,
                { width: `${Math.min(100, progressRatio * 100)}%` as any },
              ]}
            />
            <View
              style={[
                styles.scrubberThumb,
                { left: `${Math.min(100, progressRatio * 100)}%` as any },
              ]}
            />
          </Pressable>
          <Text style={styles.scrubberTime}>{formatTime(videoDuration)}</Text>
        </Animated.View>
      )}

      {showSubtitleOverlay && (
        <Animated.View
          style={[
            styles.subtitleOverlay,
            {
              bottom: subtitleBottomOffset,
              opacity: Animated.multiply(subtitleOpacity, subtitleFadeAnim),
              left: isLandscape ? Math.max(insets.left, 20) + 40 : 24,
              right: isLandscape ? Math.max(insets.right, 20) + 40 : 24,
            },
          ]}
          pointerEvents="box-none"
        >
          {isLoadingTranscript ? (
            <View style={styles.subtitleLoadingRow}>
              <ActivityIndicator size="small" color="rgba(255,255,255,0.7)" />
              <Text style={styles.subtitleLoadingText}>Loading subtitles...</Text>
            </View>
          ) : activeSubtitleText ? (
            <View style={styles.subtitleTouchable} pointerEvents="auto">
              <View style={styles.subtitleBg}>
                <SelectableWords
                  text={activeSubtitleText}
                  isActive={true}
                  savedWords={savedWords}
                  onWordTap={openWordDetail}
                  onPhraseSelected={openPhraseDetail}
                  onSelectionStart={handleSelectionStart}
                  wordStyle={styles.subtitleWordStyle}
                  activeWordStyle={styles.subtitleWordActiveStyle}
                  savedWordStyle={styles.subtitleWordSavedStyle}
                  containerStyle={styles.subtitleWordsContainer}
                />
              </View>
            </View>
          ) : transcript.length > 0 ? (
            <Text style={styles.subtitleHintText}>Tap Transcript to view full text</Text>
          ) : null}
        </Animated.View>
      )}

      {!isNativeMode && !isPanelOpen && (
        <View
          style={[
            styles.dubToggleWrap,
            {
              bottom: subtitleBottomOffset + 90,
              right: isLandscape ? Math.max(insets.right, 20) + 20 : 16,
            },
          ]}
          pointerEvents="box-none"
        >
          {dubStatus === 'generating' && (
            <View style={styles.dubToggleBtn} testID="dub-toggle-generating">
              <ActivityIndicator size={10} color="rgba(255,255,255,0.5)" />
              <Text style={styles.dubToggleTextDisabled}>
                FR {dubProgress.ready}/{dubProgress.total}
              </Text>
            </View>
          )}
          {dubStatus === 'ready' && (
            <Pressable
              onPress={toggleAudioMode}
              style={[
                styles.dubToggleBtn,
                audioMode === 'french_dub' && styles.dubToggleBtnActive,
              ]}
              testID="dub-toggle-btn"
            >
              <Text
                style={[
                  styles.dubToggleText,
                  audioMode === 'french_dub' && styles.dubToggleTextActive,
                ]}
              >
                {audioMode === 'french_dub' ? 'FR 🔊' : 'EN 🔊'}
              </Text>
            </Pressable>
          )}
        </View>
      )}

      {!isPanelOpen && (
        <View
          style={[
            styles.transcriptPillWrap,
            {
              bottom: insets.bottom + 8,
              left: 0,
              right: 0,
            },
          ]}
        >
          <Pressable
            onPress={openPanel}
            style={styles.transcriptPill}
            testID="expand-transcript-btn"
          >
            <ChevronUp size={14} color="rgba(255,255,255,0.7)" />
            <Text style={styles.transcriptPillText}>Transcript</Text>
          </Pressable>
        </View>
      )}

      <Animated.View
        style={[
          styles.transcriptPanel,
          {
            height: maxPanelH,
            transform: [{ translateY: panelTranslateYAnim }],
            paddingBottom: insets.bottom,
          },
        ]}
      >
        <View {...handlePanResponder.panHandlers}>
          <View style={styles.panelDragHandle}>
            <View style={styles.panelDragBar} />
          </View>
        </View>

        <View style={styles.panelHeader}>
          <Pressable
            onPress={collapsePanel}
            style={styles.panelCloseBtn}
            hitSlop={12}
            testID="collapse-transcript-btn"
          >
            <ChevronDown size={20} color="#fff" />
          </Pressable>
          <Text style={styles.panelTitle} numberOfLines={1}>
            {title ? decodeURIComponent(title) : video?.title ?? 'Transcript'}
          </Text>
          <View style={styles.panelHeaderRight}>
            {savedWords.size > 0 && (
              <View style={styles.gapBadgeSmall}>
                <BookOpen size={10} color={Colors.secondary} />
                <Text style={styles.gapBadgeSmallText}>{savedWords.size}</Text>
              </View>
            )}
            <Text style={styles.hintText}>Tap · Hold phrase</Text>
          </View>
        </View>

        {isLoadingTranscript ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>
              {!isNativeMode ? 'Preparing French subtitles...' : 'Loading transcript...'}
            </Text>
            {loadingMethod ? <Text style={styles.loadingMethodText}>{loadingMethod}</Text> : null}
          </View>
        ) : transcript.length === 0 ? (
          <View style={styles.loadingWrap}>
            <AlertCircle
              size={32}
              color={transcriptError ? Colors.error : 'rgba(255,255,255,0.3)'}
            />
            <Text style={styles.emptyTitle}>
              {transcriptError ? (typeof transcriptError === 'string' ? transcriptError : 'Transcript failed to load') : 'No transcript available'}
            </Text>
            <Text style={styles.emptyText}>
              {transcriptError
                ? 'Tap Retry to try again.'
                : 'This video does not have subtitles available.'}
            </Text>
            <Pressable
              style={styles.retryBtn}
              onPress={() => {
                setTranscriptError(false);
                setIsLoadingTranscript(true);
                setLoadingMethod('');
                setTranslationProgress(null);
                void (async () => {
                  try {
                    if (isNativeMode) {
                      const segments = await fetchYouTubeTranscript(
                        videoId,
                        true,
                        handleMethodChange
                      );
                      setTranscript(segments);
                      if (segments.length === 0) setTranscriptError(true);
                    } else {
                      const result = await fetchFrenchTranscriptForEnglishVideo(
                        videoId,
                        handleMethodChange,
                        handleProgressiveUpdate,
                      );
                      setTranscriptSource(result.transcriptSource);
                      setTranscript(result.segments);
                      if (result.segments.length === 0) setTranscriptError(true);
                    }
                  } catch {
                    setTranscriptError(true);
                  } finally {
                    setIsLoadingTranscript(false);
                    setIsTranslatingTranscript(false);
                    setTranslationProgress(null);
                  }
                })();
              }}
            >
              <RotateCcw size={14} color="#fff" />
              <Text style={styles.retryBtnText}>Retry</Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            <FlatList
              ref={flatListRef}
              data={transcript}
              keyExtractor={keyExtractor}
              renderItem={renderSegment}
              onScrollToIndexFailed={onScrollToIndexFailed}
              onScrollBeginDrag={handleUserScrollBegin}
              onScrollEndDrag={handleUserScrollEnd}
              onMomentumScrollEnd={handleUserScrollEnd}
              contentContainerStyle={[styles.transcriptList, { paddingBottom: insets.bottom + 20 }]}
              showsVerticalScrollIndicator={false}
              extraData={activeSegmentIndex}
              initialNumToRender={20}
              maxToRenderPerBatch={10}
              windowSize={11}
              testID="transcript-list"
            />
            {showFollowPill && (
              <Pressable style={styles.followPill} onPress={handleFollowAlongPress}>
                <Text style={styles.followPillText}>Follow along ↓</Text>
              </Pressable>
            )}
          </View>
        )}
      </Animated.View>

      <View style={styles.wordDetailLayer} pointerEvents={isWordDetailOpen ? 'auto' : 'none'}>
        <WordDetailSheet
          word={selectedWord?.word ?? null}
          context={selectedWord?.context ?? ''}
          isAlreadySaved={selectedWord ? savedWords.has(selectedWord.word.toLowerCase()) : false}
          onAddToGaps={handleAddToGaps}
          onDismiss={handleDismissWordDetail}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  videoFull: {
    position: 'absolute',
    top: 0,
    left: 0,
    backgroundColor: '#000',
  },
  tapOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 15,
  },
  controlsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 15,
  },
  controlsCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 40,
  },
  controlBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlBtnMain: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlBtnLabel: {
    fontSize: 9,
    fontWeight: '700' as const,
    color: 'rgba(255,255,255,0.8)',
    position: 'absolute',
    bottom: 6,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 30,
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingBottom: 12,
  },
  topBarBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  translatingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
  },
  translatingText: {
    fontSize: 11,
    color: Colors.primary,
    fontWeight: '600' as const,
  },
  sourceBadge: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  sourceBadgeText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 0.3,
  },
  gapBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
  },
  gapBadgeText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.secondary,
  },
  speedBadge: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
  },
  speedBadgeText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#fff',
    letterSpacing: 0.3,
  },
  scrubberContainer: {
    position: 'absolute',
    zIndex: 26,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scrubberTime: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: 'rgba(255,255,255,0.7)',
    fontVariant: ['tabular-nums'],
    minWidth: 36,
    textAlign: 'center' as const,
  },
  scrubberTrack: {
    flex: 1,
    height: 28,
    justifyContent: 'center',
  },
  scrubberBg: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  scrubberFill: {
    position: 'absolute',
    left: 0,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: Colors.primary,
  },
  scrubberThumb: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.primary,
    marginLeft: -6,
    top: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.4,
    shadowRadius: 2,
    elevation: 3,
  },
  subtitleOverlay: {
    position: 'absolute',
    alignItems: 'center',
    zIndex: 25,
  },
  subtitleTouchable: {
    alignItems: 'center',
  },
  subtitleBg: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  subtitleWordStyle: {
    fontSize: 18,
    lineHeight: 26,
    color: '#fff',
    fontWeight: '600' as const,
    textShadowColor: 'rgba(0,0,0,0.95)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  subtitleWordActiveStyle: {
    color: '#fff',
  },
  subtitleWordSavedStyle: {
    color: Colors.secondary,
    textDecorationLine: 'underline' as const,
    textDecorationColor: Colors.secondary,
  },
  subtitleWordsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  subtitleHintText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.3)',
    textAlign: 'center' as const,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  subtitleLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  subtitleLoadingText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '500' as const,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  transcriptPillWrap: {
    position: 'absolute',
    zIndex: 50,
    alignItems: 'center',
  },
  transcriptPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  transcriptPillText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: 'rgba(255,255,255,0.8)',
    letterSpacing: 0.2,
  },
  pillCountBadge: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  pillCountText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#fff',
  },
  transcriptPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    zIndex: 55,
    overflow: 'hidden',
  },
  panelDragHandle: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 4,
  },
  panelDragBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    gap: 10,
  },
  panelCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  panelTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#fff',
  },
  panelHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  gapBadgeSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(13,148,136,0.15)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
  },
  gapBadgeSmallText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: Colors.secondary,
  },
  hintText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.25)',
  },
  transcriptList: {
    paddingTop: 4,
    paddingBottom: 20,
  },
  segmentRow: {
    flexDirection: 'row',
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
  },
  segmentRowActive: {
    backgroundColor: 'rgba(249, 115, 22, 0.08)',
    borderLeftColor: Colors.primary,
  },
  segmentRowTapped: {
    backgroundColor: 'rgba(249, 115, 22, 0.2)',
  },
  segmentTimeCol: {
    width: 46,
    marginRight: 8,
    alignItems: 'flex-start',
    gap: 4,
  },
  segmentTime: {
    fontSize: 11,
    fontWeight: '500' as const,
    color: 'rgba(255,255,255,0.25)',
    fontVariant: ['tabular-nums'],
    paddingTop: 2,
  },
  segmentTimeActive: {
    color: Colors.primary,
    fontWeight: '700' as const,
  },
  replayBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(249, 115, 22, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentTextCol: {
    flex: 1,
  },
  segmentTextColInner: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
  },
  wordDetailLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
  },
  word: {
    fontSize: 15,
    lineHeight: 24,
    color: 'rgba(255,255,255,0.4)',
  },
  wordActive: {
    color: '#fff',
    fontWeight: '600' as const,
  },
  wordSaved: {
    color: Colors.secondary,
    textDecorationLine: 'underline' as const,
    textDecorationColor: Colors.secondary,
  },
  followPill: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: 20,
    backgroundColor: 'rgba(249, 115, 22, 0.9)',
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  followPillText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#fff',
    letterSpacing: 0.2,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.4)',
  },
  loadingMethodText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.25)',
    textAlign: 'center' as const,
    marginTop: 2,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center' as const,
  },
  emptyText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.3)',
    textAlign: 'center' as const,
    lineHeight: 18,
    paddingHorizontal: 24,
  },
  retryBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    backgroundColor: Colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 4,
  },
  retryBtnText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#fff',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
    gap: 16,
  },
  errorText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.5)',
  },
  errorButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: Colors.primary,
    borderRadius: 10,
  },
  errorButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#fff',
  },
  dubToggleWrap: {
    position: 'absolute',
    zIndex: 28,
    alignItems: 'flex-end',
  },
  dubToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  dubToggleBtnActive: {
    backgroundColor: 'rgba(249,115,22,0.85)',
    borderColor: 'rgba(249,115,22,0.9)',
  },
  dubToggleText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 0.3,
  },
  dubToggleTextActive: {
    color: '#fff',
  },
  dubToggleTextDisabled: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 0.2,
  },
});
