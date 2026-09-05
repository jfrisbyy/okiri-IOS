# Okiri: French Learning App

## Overview
Okiri is an Expo React Native application designed for immersive French language learning. It offers a mobile-first experience, accessible via web using Expo's web export functionality. The app focuses on comprehensive skill development through reading, speaking, listening, and personalized gap-based learning, aiming to guide users from A1 to B1 proficiency.

## User Preferences
The user wants me to act as a replit coding agent.
I want iterative development.
Ask before making major changes.

## System Architecture
**Framework & Core Technologies:**
- **Frontend:** Expo SDK 54, React Native, react-native-web
- **Navigation:** expo-router
- **State Management:** Zustand
- **Styling:** React Native StyleSheet with custom theming (soft welcoming green color scheme)
- **UI/UX:**
    - Professional UI redesign with coral/peach gradient headers and refined cards.
    - Card-based home page navigation (no bottom tab bar).
    - Minimal back-button-only headers on section pages (translator, tenses, accent, listen, text) for cleaner navigation.
    - Smooth slide-from-right page transitions throughout the app.
    - iMessage-style chat interface for AI interaction.
    - Custom audio player with playback controls.
    - **Kiri the Fox Mascot:** Cute illustrated fox character using sprite sheet with 8 mood states (idle, happy, thinking, encouraging, celebrating, sad, confused, sleeping). Features smooth animations (bounce, scale pulse, wobble/rotate) per mood. Uses transparent PNG sprite sheet at assets/kiri/poses.png with 4x3 grid. Appears on home page and reacts to user answers in practice modes.

**Key Features:**
- **Content Library:** 115 French articles and 125 listening comprehension items, categorized by difficulty (Beginner, Easy, Medium, Hard, University), region (France, Martinique, Quebec, etc.), and type (Dialogue, Story, Culture, News, etc.). Features 4-dimensional filtering including read/unread status. Post-reading completion page with Kiri celebration, stats summary, gaps review, and encouragement messages.
- **Learning Path System:** Structured into 4 modules (A1 → B1 progression) with 20 foundation lessons focusing on pronunciation. Tracks module progress.
- **Listening Mode:**
    - Pre-generated content (125 dialogues/stories) with on-demand ElevenLabs TTS audio generation.
    - Segment capture functionality with instant pre-generated French-English translations, savable to the Gap deck.
    - Features two French voices (Charlotte, Henri) for dialogues and a single narrator voice for stories.
    - Custom audio player with 5-second skip and playback speed controls.
- **Text Mode (AI French Chat):**
    - Real-time iMessage-style chat with 5 distinct AI personalities (Marie, Lucas, Camille, Théo, Emma), each with unique typing styles and specializations.
    - Utilizes OpenAI gpt-4o-mini for natural French conversation.
- **Gap Engine System:**
    - Personalized learning system categorizing weaknesses into vocabulary, grammar, pronunciation, phrasing, and register.
    - **SM-2 Spaced Repetition:** Uses SM-2 algorithm (utils/srs.ts) with ease factor (default 2.5, min 1.3), interval progression (1→6→EF*interval days), and quality-based updates. Mastery after 5 consecutive correct answers.
    - **CEFR Level Tagging:** AI concept extraction assigns CEFR levels (A1-C2) to each gap. Used for learner level estimation and i+1 lesson filtering.
    - **Structured Lesson Phases:** Lessons are organized into Input (multiple choice, ~35%) → Guided (fill-blank, correction, ~35%) → Production (typing, translation, ~30%) phases for pedagogical progression.
    - **SRS-Aware Lesson Generation:** Prioritizes gaps that are due for review (overdue first), filters by learner's CEFR level +1, and falls back to all active gaps if fewer than 3 are due.
    - Generates up to 25-question practice sessions with 5 prompt types: Multiple Choice, Fill-in-blank, Correction, Production, Translation.
    - Features AI-powered concept extraction (via OpenAI) for pedagogical question generation from speech, foundation, and listening gaps. Reading gaps use fallback word-meaning prompts.
    - Provides real-time feedback with hints and correct answers, including accent/punctuation-tolerant checking.
    - **Migration:** Existing gaps without SRS fields are migrated on load with default easeFactor=2.5, currentInterval based on reviewCount, and nextReviewAt derived from lastReviewedAt.
- **Speech Practice & AI Feedback:**
    - Real-time speech transcription using Web Speech API.
    - Grammar checking via LanguageTool API, with detailed English explanations and contextual examples.
    - AI-powered fluency suggestions for natural phrasing.
    - Automatic addition of grammar errors and fluency suggestions to the Gap deck.
    - Speech Recording Log feature stores up to 50 sessions.
    - TTS playback buttons for corrections and suggestions.

- **Resources Section:**
    - **French Tenses Table:** Complete verb conjugation tables for 12 common verbs across 6 tenses (Present, Passé Composé, Imparfait, Futur Simple, Conditionnel, Subjonctif). Includes tense descriptions, usage examples, and expandable verb cards.
    - **Translator:** Bidirectional English-French translator with Type mode (text input) and Listen mode (speech recognition). Features language swap, TTS playback, and clipboard copy.
    - **Pronunciation Practice (Accent):** AI-powered pronunciation assessment using Azure Speech Services with phoneme-level grading. Features 6 sound categories (Nasal Vowels, French R, U vs OU, Liaisons, Silent Letters, French Vowels) with 12 words each. Records user pronunciation, analyzes at phoneme level, provides accuracy scores (0-100), and gives specific feedback on which sounds need improvement.
    - **French Idioms:** 170 authentic French idioms across 10 categories (Animals, Food & Drink, Body Parts, Weather & Nature, Emotions & Feelings, Money & Business, Time & Age, Relationships, Work & Effort, Everyday Life). Each idiom includes literal translation, English meaning, example sentence with translation, and TTS playback. Features search, category filtering, and a Practice mode with 10-question quiz sessions featuring 3 question types (match meaning, identify French phrase, match literal translation), score tracking, streak counter, and detailed feedback.

## External Dependencies
- **ElevenLabs API:** For high-quality French text-to-speech pronunciation.
- **@rork-ai/toolkit-sdk:** For AI text generation (word definitions, phrase generation).
- **Web Speech API:** For real-time speech recognition during practice and translator.
- **LanguageTool API:** For detecting French grammar errors.
- **OpenAI (gpt-4o-mini):** For AI chat personalities, translation, and concept extraction in the Gap Engine.
- **Azure Speech Services:** For phoneme-level pronunciation assessment in the Accent practice feature.