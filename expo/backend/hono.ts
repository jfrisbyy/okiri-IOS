import { trpcServer } from "@hono/trpc-server";
import { Hono } from "hono";
import { cors } from "hono/cors";

import { appRouter } from "./trpc/app-router";
import { createContext } from "./trpc/create-context";

const app = new Hono();

app.use("*", cors());

app.use(
  "/trpc/*",
  trpcServer({
    endpoint: "/api/trpc",
    router: appRouter,
    createContext,
  }),
);

app.get("/", (c) => {
  return c.json({ status: "ok", message: "API is running", version: "v3-supadata" });
});

interface TranscriptSegment {
  id: string;
  text: string;
  start: number;
  duration: number;
}

function cleanHtmlEntities(text: string): string {
  return text
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\n/g, " ")
    .trim();
}

async function fetchViaSupadata(
  videoId: string,
  lang: string,
): Promise<{ segments: TranscriptSegment[]; source: string; availableLangs?: string[] } | null> {
  const apiKey = (process.env.SUPADATA_API_KEY || process.env.EXPO_PUBLIC_SUPADATA_API_KEY || "").trim();
  if (!apiKey) {
    console.log("[YT] Supadata: no API key configured");
    return null;
  }

  const langParam = lang.split("-")[0];
  const url = `https://api.supadata.ai/v1/youtube/transcript?videoId=${videoId}&lang=${langParam}`;
  console.log(`[YT] Supadata: fetching transcript for ${videoId} (lang=${langParam})`);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);

  try {
    const res = await fetch(url, {
      headers: {
        "x-api-key": apiKey,
        "Accept": "application/json",
      },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.log(`[YT] Supadata returned ${res.status}: ${errText.substring(0, 200)}`);
      return null;
    }

    const data = (await res.json()) as any;
    const content = data?.content;
    const availableLangs: string[] = Array.isArray(data?.availableLangs) ? data.availableLangs : [];

    if (!Array.isArray(content) || content.length === 0) {
      console.log(`[YT] Supadata: no content for lang=${langParam}, availableLangs=${availableLangs.join(",") || "none"}`);
      return { segments: [], source: "supadata:empty", availableLangs };
    }

    const segments: TranscriptSegment[] = content
      .filter((item: any) => item.text && item.text.trim())
      .map((item: any, idx: number) => ({
        id: `supadata-${videoId}-${idx}`,
        text: cleanHtmlEntities(item.text),
        start: (item.offset ?? 0) / 1000,
        duration: (item.duration ?? 0) / 1000,
      }));

    if (segments.length > 0) {
      console.log(`[YT] Supadata: got ${segments.length} segments (lang=${data.lang || langParam})`);
      return { segments, source: `supadata:${data.lang || langParam}`, availableLangs };
    }

    console.log("[YT] Supadata: parsed 0 valid segments from content");
    return { segments: [], source: "supadata:empty", availableLangs };
  } catch (err: any) {
    clearTimeout(timer);
    console.log(`[YT] Supadata error: ${err?.message}`);
    return null;
  }
}

app.get("/youtube-transcript", async (c) => {
  const videoId = c.req.query("videoId");
  const langParam = c.req.query("lang");
  const preferOriginal = c.req.query("preferOriginal");

  if (!videoId) {
    return c.json({ error: "videoId is required" }, 400);
  }

  let lang = langParam || (preferOriginal === "1" ? "en" : "fr");

  console.log(`\n[YT] ========== Transcript: ${videoId} (lang=${lang}) ==========`);

  const result = await fetchViaSupadata(videoId, lang);

  if (result && result.segments.length > 0) {
    return c.json({ segments: result.segments, source: result.source });
  }

  if (result && result.availableLangs && result.availableLangs.length > 0) {
    const fallbackLang = result.availableLangs[0];
    if (fallbackLang && fallbackLang !== lang.split("-")[0]) {
      console.log(`[YT] Retrying with first available language: ${fallbackLang}`);
      const retryResult = await fetchViaSupadata(videoId, fallbackLang);
      if (retryResult && retryResult.segments.length > 0) {
        return c.json({ segments: retryResult.segments, source: retryResult.source });
      }
    }
  }

  console.log(`[YT] FAILED: No transcript for ${videoId}`);
  return c.json({ segments: [], source: "none" });
});

app.get("/youtube-transcript-translate", async (c) => {
  const videoId = c.req.query("videoId");
  const lang = c.req.query("lang") || "fr";

  if (!videoId) {
    return c.json({ error: "videoId is required" }, 400);
  }

  const apiKey = (process.env.SUPADATA_API_KEY || process.env.EXPO_PUBLIC_SUPADATA_API_KEY || "").trim();
  if (!apiKey) {
    console.log("[YT] Translate: no Supadata API key");
    return c.json({ segments: [], source: "no_key" });
  }

  console.log(`[YT] Translate endpoint: ${videoId} → ${lang}`);

  try {
    const url = `https://api.supadata.ai/v1/youtube/transcript/translate?videoId=${videoId}&lang=${lang}&text=false`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25000);

    const res = await fetch(url, {
      headers: {
        "x-api-key": apiKey,
        "Accept": "application/json",
      },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.log(`[YT] Translate returned ${res.status}: ${errText.substring(0, 200)}`);
      return c.json({ segments: [], source: "translate_error" });
    }

    const data = (await res.json()) as any;
    const content = data?.content;

    if (!Array.isArray(content) || content.length === 0) {
      console.log(`[YT] Translate: no content returned for ${videoId}`);
      return c.json({ segments: [], source: "translate_empty" });
    }

    const segments: TranscriptSegment[] = content
      .filter((item: any) => item.text && item.text.trim())
      .map((item: any, idx: number) => ({
        id: `translate-${videoId}-${idx}`,
        text: cleanHtmlEntities(item.text),
        start: (item.offset ?? 0) / 1000,
        duration: (item.duration ?? 0) / 1000,
      }));

    console.log(`[YT] Translate: got ${segments.length} translated segments for ${videoId}`);
    return c.json({ segments, source: `supadata_translate:${data.lang || lang}` });
  } catch (err: any) {
    console.log(`[YT] Translate error: ${err?.message}`);
    return c.json({ segments: [], source: "translate_fetch_error" });
  }
});

app.get("/youtube-transcript-check", async (c) => {
  const videoId = c.req.query("videoId");
  if (!videoId) {
    return c.json({ error: "videoId is required", hasTranscript: false }, 400);
  }

  const apiKey = (process.env.SUPADATA_API_KEY || process.env.EXPO_PUBLIC_SUPADATA_API_KEY || "").trim();
  if (!apiKey) {
    return c.json({ hasTranscript: false, reason: "no_api_key" });
  }

  try {
    const url = `https://api.supadata.ai/v1/youtube/transcript?videoId=${videoId}&lang=fr`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(url, {
      headers: { "x-api-key": apiKey, "Accept": "application/json" },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      return c.json({ hasTranscript: false, reason: "api_error" });
    }

    const data = (await res.json()) as any;
    const hasContent = Array.isArray(data?.content) && data.content.length > 0;
    const hasLangs = Array.isArray(data?.availableLangs) && data.availableLangs.length > 0;

    return c.json({ hasTranscript: hasContent || hasLangs, videoId });
  } catch (err: any) {
    console.log(`[YT] Transcript check error for ${videoId}: ${err?.message}`);
    return c.json({ hasTranscript: false, reason: "fetch_error" });
  }
});

app.post("/youtube-transcript-check-batch", async (c) => {
  try {
    const body = (await c.req.json()) as any;
    const videoIds: string[] = Array.isArray(body?.videoIds) ? body.videoIds.slice(0, 20) : [];

    if (videoIds.length === 0) {
      return c.json({ results: {} });
    }

    const apiKey = (process.env.SUPADATA_API_KEY || process.env.EXPO_PUBLIC_SUPADATA_API_KEY || "").trim();
    if (!apiKey) {
      const empty: Record<string, boolean> = {};
      videoIds.forEach((id) => { empty[id] = false; });
      return c.json({ results: empty });
    }

    const results: Record<string, boolean> = {};

    const checkOne = async (videoId: string): Promise<void> => {
      try {
        const url = `https://api.supadata.ai/v1/youtube/transcript?videoId=${videoId}&lang=fr`;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 10000);
        const res = await fetch(url, {
          headers: { "x-api-key": apiKey, "Accept": "application/json" },
          signal: controller.signal,
        });
        clearTimeout(timer);

        if (!res.ok) {
          results[videoId] = false;
          return;
        }
        const data = (await res.json()) as any;
        const hasContent = Array.isArray(data?.content) && data.content.length > 0;
        const hasLangs = Array.isArray(data?.availableLangs) && data.availableLangs.length > 0;
        results[videoId] = hasContent || hasLangs;
      } catch {
        results[videoId] = false;
      }
    };

    const CONCURRENCY = 5;
    for (let i = 0; i < videoIds.length; i += CONCURRENCY) {
      const batch = videoIds.slice(i, i + CONCURRENCY);
      await Promise.all(batch.map(checkOne));
    }

    console.log(`[YT] Batch check: ${videoIds.length} videos, ${Object.values(results).filter(Boolean).length} have transcripts`);
    return c.json({ results });
  } catch (err: any) {
    console.error(`[YT] Batch check error: ${err?.message}`);
    return c.json({ results: {} }, 500);
  }
});

app.post("/pronunciation-assessment", async (c) => {
  try {
    const apiKey = process.env.EXPO_PUBLIC_AZURE_SPEECH_KEY?.trim();
    const region = process.env.EXPO_PUBLIC_AZURE_SPEECH_REGION?.trim();

    if (!apiKey || !region) {
      console.error("[PronServer] Missing Azure credentials");
      return c.json({ error: "Azure Speech credentials not configured on server." }, 500);
    }

    const formData = await c.req.formData();
    const audioFile = formData.get("audio");
    const referenceText = formData.get("referenceText") as string;
    const language = (formData.get("language") as string) || "fr-FR";

    if (!audioFile || !(audioFile instanceof File)) {
      return c.json({ error: "No audio file provided." }, 400);
    }

    if (!referenceText || referenceText.trim().length === 0) {
      return c.json({ error: "No reference text provided." }, 400);
    }

    const audioFormat = (formData.get("format") as string) || "wav";

    console.log("[PronServer] Received assessment request");
    console.log("[PronServer] Reference:", referenceText);
    console.log("[PronServer] Language:", language);
    console.log("[PronServer] Audio size:", audioFile.size, "bytes, type:", audioFile.type, "format:", audioFormat);

    const pronunciationConfig = {
      ReferenceText: referenceText.trim(),
      GradingSystem: "HundredMark",
      Granularity: "Phoneme",
      Dimension: "Comprehensive",
      EnableMiscue: true,
      PhonemeAlphabet: "IPA",
      NBestPhonemeCount: 5,
    };

    const configJson = JSON.stringify(pronunciationConfig);
    const configBase64 = Buffer.from(configJson, "utf-8").toString("base64");

    let azureContentType = "audio/wav; codecs=audio/pcm; samplerate=16000";
    if (audioFormat === "ogg" || audioFile.type?.includes("ogg")) {
      azureContentType = "audio/ogg; codecs=opus";
    } else if (audioFormat === "mp4" || audioFile.type?.includes("mp4") || audioFile.type?.includes("m4a")) {
      azureContentType = "audio/mp4";
    } else if (audioFile.type?.includes("webm")) {
      azureContentType = "audio/webm; codecs=opus";
    }

    const endpoint = `https://${region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1`;
    const url = `${endpoint}?language=${language}&format=detailed`;

    const audioBuffer = await audioFile.arrayBuffer();
    console.log("[PronServer] Sending", audioBuffer.byteLength, "bytes to Azure at", region);

    const azureResponse = await fetch(url, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": apiKey,
        "Pronunciation-Assessment": configBase64,
        "Content-Type": azureContentType,
        Accept: "application/json",
      },
      body: audioBuffer,
    });

    if (!azureResponse.ok) {
      const errorText = await azureResponse.text().catch(() => "unknown");
      console.error("[PronServer] Azure error:", azureResponse.status, errorText);
      return c.json({ error: `Azure error (${azureResponse.status}): ${errorText}` }, 502);
    }

    const result = (await azureResponse.json()) as any;
    console.log("[PronServer] Recognition status:", result.RecognitionStatus);

    if (result.RecognitionStatus !== "Success" || !result.NBest?.length) {
      let msg: string;
      switch (result.RecognitionStatus) {
        case "NoMatch":
          msg = "No speech detected. Please speak clearly.";
          break;
        case "InitialSilenceTimeout":
          msg = "No speech was heard.";
          break;
        default:
          msg = `Recognition issue: ${result.RecognitionStatus}`;
      }
      return c.json({
        accuracyScore: 0,
        pronunciationScore: 0,
        completenessScore: 0,
        fluencyScore: 0,
        recognizedText: "",
        words: [],
        phonemes: [],
        feedback: msg,
      });
    }

    let best = result.NBest[0];
    let assessment = best.PronunciationAssessment;

    if (!assessment && best.AccuracyScore !== undefined) {
      assessment = {
        AccuracyScore: best.AccuracyScore,
        FluencyScore: best.FluencyScore,
        CompletenessScore: best.CompletenessScore,
        PronScore: best.PronScore,
      };
    }

    if (!assessment && result.NBest.length > 1) {
      for (let i = 1; i < result.NBest.length; i++) {
        const entry = result.NBest[i];
        if (entry.PronunciationAssessment) {
          best = entry;
          assessment = entry.PronunciationAssessment;
          break;
        } else if (entry.AccuracyScore !== undefined) {
          best = entry;
          assessment = {
            AccuracyScore: entry.AccuracyScore,
            FluencyScore: entry.FluencyScore,
            CompletenessScore: entry.CompletenessScore,
            PronScore: entry.PronScore,
          };
          break;
        }
      }
    }

    if (!assessment) {
      console.error("[PronServer] No PronunciationAssessment in response");
      return c.json({ error: "Azure returned speech recognition but no pronunciation scores." }, 502);
    }

    console.log("[PronServer] Scores - Accuracy:", assessment.AccuracyScore, "Fluency:", assessment.FluencyScore);

    const words = (best.Words || []).map((w: any) => ({
      word: w.Word,
      accuracyScore: w.PronunciationAssessment?.AccuracyScore ?? w.AccuracyScore ?? 0,
      errorType: w.PronunciationAssessment?.ErrorType ?? w.ErrorType ?? "None",
      phonemes: (w.Phonemes || w.Syllables || []).map((p: any) => ({
        phoneme: p.Phoneme,
        accuracyScore: p.PronunciationAssessment?.AccuracyScore ?? p.AccuracyScore ?? 0,
        nBestPhonemes: (p.PronunciationAssessment?.NBestPhonemes || p.NBestPhonemes || []).map((nb: any) => ({
          phoneme: nb.Phoneme,
          score: nb.Score,
        })),
      })),
    }));

    const allPhonemes = words.flatMap((w: any) => w.phonemes);

    return c.json({
      accuracyScore: assessment.AccuracyScore ?? 0,
      pronunciationScore: assessment.PronScore ?? 0,
      completenessScore: assessment.CompletenessScore ?? 0,
      fluencyScore: assessment.FluencyScore ?? 0,
      recognizedText: best.Display || "",
      words,
      phonemes: allPhonemes,
      feedback: "",
    });
  } catch (err: any) {
    console.error("[PronServer] Unexpected error:", err?.message);
    return c.json({ error: err?.message || "Internal server error" }, 500);
  }
});

export default app;
