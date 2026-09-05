declare const Deno: {
  serve(handler: (req: Request) => Promise<Response> | Response): void;
  env: { get(key: string): string | undefined };
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SCENARIO_DESCRIPTIONS: Record<string, string> = {
  'cafe': 'ordering drinks and pastries at a French café, chatting casually with the barista',
  'directions': 'asking for and giving directions in a French city, navigating streets and public transport',
  'job-interview': 'a formal job interview in French, discussing experience, skills, and motivation',
  'making-friends': 'meeting someone new at a social gathering, sharing hobbies and making plans',
  'doctor': 'visiting a doctor in France, describing symptoms and understanding medical advice',
  'shopping': 'shopping for clothes at a French boutique, asking about sizes, colors, and prices',
  'restaurant': 'dining at a French restaurant, reading the menu, ordering food, and handling the bill',
  'free-conversation': 'a free-form conversation on any topic the student chooses',
};

function buildSystemPrompt(
  targetLanguage: string,
  cefrLevel: string,
  scenarioId: string
): string {
  const scenarioDesc = SCENARIO_DESCRIPTIONS[scenarioId] || 'a general conversation practice session';

  return `You are a friendly, patient language tutor having a real-time conversation in ${targetLanguage}. The student's current level is ${cefrLevel}. The conversation scenario is: ${scenarioDesc}.

Rules:
- Speak ONLY in ${targetLanguage}. Never use English unless the student explicitly asks for help.
- Match your vocabulary and grammar complexity to ${cefrLevel} level. For A1: use only basic present tense, common nouns, simple sentences. For A2: add past tense, more varied vocabulary. For B1: use subjunctive, conditionals, idiomatic expressions. For B2: use complex structures, nuance, cultural references.
- Keep responses conversational and natural. 2-3 sentences maximum per turn.
- Stay in character for the scenario.
- If the student makes a grammar error, do NOT correct them mid-conversation. Just respond naturally.
- If the student seems stuck (very short responses or long pauses noted in context), simplify your language and ask an easy yes/no question.
- If the student is doing well, gradually introduce slightly more complex vocabulary or grammar.
- Be warm, encouraging, and react naturally to what they say.

After your conversational response, on a new line, output a JSON block wrapped in <feedback> tags with this structure:
<feedback>{"corrections": [{"original": "what they said wrong", "corrected": "correct version", "rule": "grammar rule name"}], "newVocabulary": [{"word": "new word you used", "translation": "English translation", "level": "CEFR level"}], "topicSuggestion": "optional hint for what the student could say next"}</feedback>`;
}

async function callAnthropic(
  systemPrompt: string,
  conversationHistory: Array<{ role: string; content: string }>,
  userMessage: string,
  apiKey: string
): Promise<Response> {
  const messages = [
    ...conversationHistory.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user' as const, content: userMessage },
  ];

  console.log('[converse] Calling Anthropic with', messages.length, 'messages');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages,
      stream: true,
    }),
  });

  return response;
}

async function callOpenAI(
  systemPrompt: string,
  conversationHistory: Array<{ role: string; content: string }>,
  userMessage: string,
  apiKey: string
): Promise<Response> {
  const messages = [
    { role: 'system' as const, content: systemPrompt },
    ...conversationHistory.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user' as const, content: userMessage },
  ];

  console.log('[converse] Calling OpenAI with', messages.length, 'messages');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages,
      stream: true,
      max_tokens: 1024,
    }),
  });

  return response;
}

async function streamAnthropicResponse(
  response: Response,
  writer: WritableStreamDefaultWriter<Uint8Array>
): Promise<void> {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const reader = response.body!.getReader();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (data === '[DONE]') continue;

      try {
        const parsed = JSON.parse(data);
        if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
          const sseEvent = `data: ${JSON.stringify({ text: parsed.delta.text })}\n\n`;
          await writer.write(encoder.encode(sseEvent));
        }
      } catch {
        console.log('[converse] Failed to parse Anthropic SSE chunk');
      }
    }
  }
}

async function streamOpenAIResponse(
  response: Response,
  writer: WritableStreamDefaultWriter<Uint8Array>
): Promise<void> {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const reader = response.body!.getReader();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (data === '[DONE]') continue;

      try {
        const parsed = JSON.parse(data);
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) {
          const sseEvent = `data: ${JSON.stringify({ text: delta })}\n\n`;
          await writer.write(encoder.encode(sseEvent));
        }
      } catch {
        console.log('[converse] Failed to parse OpenAI SSE chunk');
      }
    }
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json();
    const {
      sessionId,
      userMessage,
      conversationHistory = [],
      cefrLevel = 'A1',
      targetLanguage = 'French',
      scenarioId = 'free-conversation',
    } = body;

    console.log('[converse] Request:', { sessionId, cefrLevel, targetLanguage, scenarioId, historyLen: conversationHistory.length });

    if (!userMessage) {
      return new Response(JSON.stringify({ error: 'userMessage is required' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const systemPrompt = buildSystemPrompt(targetLanguage, cefrLevel, scenarioId);

    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
    const openaiKey = Deno.env.get('OPENAI_API_KEY');

    let llmResponse: Response | null = null;
    let provider: 'anthropic' | 'openai' = 'anthropic';

    if (anthropicKey) {
      try {
        llmResponse = await callAnthropic(systemPrompt, conversationHistory, userMessage, anthropicKey);
        if (!llmResponse.ok) {
          const errorText = await llmResponse.text();
          console.log('[converse] Anthropic error:', llmResponse.status, errorText);
          llmResponse = null;
        }
      } catch (err) {
        console.log('[converse] Anthropic call failed:', err);
        llmResponse = null;
      }
    }

    if (!llmResponse && openaiKey) {
      provider = 'openai';
      try {
        llmResponse = await callOpenAI(systemPrompt, conversationHistory, userMessage, openaiKey);
        if (!llmResponse.ok) {
          const errorText = await llmResponse.text();
          console.log('[converse] OpenAI error:', llmResponse.status, errorText);
          llmResponse = null;
        }
      } catch (err) {
        console.log('[converse] OpenAI call failed:', err);
        llmResponse = null;
      }
    }

    if (!llmResponse) {
      return new Response(
        JSON.stringify({ error: 'No LLM provider available. Set ANTHROPIC_API_KEY or OPENAI_API_KEY.' }),
        {
          status: 500,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('[converse] Streaming response from', provider);

    const { readable, writable } = new TransformStream<Uint8Array>();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    const streamPromise = (async () => {
      try {
        if (provider === 'anthropic') {
          await streamAnthropicResponse(llmResponse!, writer);
        } else {
          await streamOpenAIResponse(llmResponse!, writer);
        }
        await writer.write(encoder.encode('data: [DONE]\n\n'));
      } catch (err) {
        console.log('[converse] Streaming error:', err);
        const errorEvent = `data: ${JSON.stringify({ error: 'Stream interrupted' })}\n\n`;
        await writer.write(encoder.encode(errorEvent));
      } finally {
        await writer.close();
      }
    })();

    void streamPromise;

    return new Response(readable, {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (err) {
    console.log('[converse] Handler error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: String(err) }),
      {
        status: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      }
    );
  }
});
