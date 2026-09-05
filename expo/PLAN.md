# Voice-First Conversation Redesign

## Overview

Transform the Converse screen from a chat-style interface into a **voice-first phone call experience**. One tap starts listening, silence auto-sends. The screen centers on a large microphone with live captions — no text input, no "send" button.

---

### **Features**

- **Tap-to-talk with auto-silence detection**: Tap the mic once to start speaking. The app detects when you stop talking and automatically sends your speech — no need to tap again or press "send"
- **Scenario selection on the call screen**: Horizontally scrollable scenario cards right on the main screen — pick one and the call begins immediately
- **Live subtitle captions**: When the AI speaks, its words appear as subtitles near the bottom of the screen (like closed captions on a phone call)
- **Real-time conversation flow**: AI speaks via TTS automatically after each of your turns — feels like a natural back-and-forth call
- **Hint button**: A small lightbulb icon tucked to the side — tap it if you're stuck and need a suggestion
- **End call button**: Clearly visible "hang up" style button to end the conversation
- **Post-conversation review**: After ending, see your scores (pronunciation, grammar, fluency), new vocabulary, and full transcript — same as today

---

### **Design**

- **Clean light background** with the app's warm cream/white tones — the microphone is the visual centerpiece
- **Large centered microphone button** (~100px) with a pulsing glow animation when listening and animated sound wave rings when recording
- **Scenario picker**: Horizontal scroll of compact pill/chip cards at the top showing emoji + title for each scenario. The active scenario is highlighted. "Free Conversation" is the default
- **Subtitle area**: A translucent caption bar near the bottom showing the AI's current speech text, fading in/out with each sentence
- **Minimal header**: Just a back arrow, the scenario emoji + name, a timer, and a red "End" pill button
- **Status indicators**: Visual cues for "Listening…", "Processing…", "Speaking…" states shown around or below the mic
- **Recording state**: Mic turns orange-red with expanding ripple rings. A live partial transcript appears above the mic in a soft bubble
- **No text input field** — the keyboard and send button are completely removed
- **Smooth transitions**: Fade/scale animations between idle, listening, processing, and AI-speaking states

---

### **Screens**

1. **Main Call Screen** (replaces both the old picker and conversation screens)
  - Top: horizontal scrollable scenario chips — tap one to start/switch
  - Center: large microphone button with state animations
  - Below mic: status text ("Tap to speak", "Listening…", "Kiri is thinking…", "Kiri is speaking…")
  - Bottom: subtitle caption area showing AI speech text
  - Corner: hint button (lightbulb) and end-call button
  - When no conversation is active, the mic shows "Pick a scenario and start talking"
2. **Review Screen** (kept as-is)
  - Shows after ending a conversation
  - Overall score ring, stat cards (pronunciation, grammar, fluency, new words)
  - Option to add vocabulary to review queue
  - Full transcript with expandable message details
  - "New Conversation" and "Back to Home" buttons

