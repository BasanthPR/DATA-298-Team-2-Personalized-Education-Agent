const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const OpenAI = require('openai');

const router = express.Router();

const GEMINI_API_KEY = process.env.VITE_GEMINI_API_KEY;
const OPENAI_API_KEY = process.env.VITE_OPENAI_API_KEY;
const DEEPSEEK_API_KEY = process.env.VITE_DEEPSEEK_API_KEY;

// URL for the finetuned model server (Modal or local FastAPI)
// Set FINETUNED_API_URL in .env to the Modal endpoint, e.g.:
//   FINETUNED_API_URL=https://<workspace>--piab-inference-inferenceserver-ask.modal.run
// Falls back to local FastAPI on port 8001 if not set.
const FINETUNED_API_URL = process.env.FINETUNED_API_URL || 'http://localhost:8001/ask';

// If finetuned model takes longer than this, fall back to DeepSeek API
const FINETUNED_TIMEOUT_MS = parseInt(process.env.FINETUNED_TIMEOUT_MS || '30000', 10);

// Clean markdown from LLM
const cleanResponse = (text) => text.replace(/```json/g, "").replace(/```/g, "").trim();

// Providers Initialization
const geminiClient = new GoogleGenerativeAI(GEMINI_API_KEY);
const geminiModel = geminiClient.getGenerativeModel({
    model: "gemini-2.0-flash",
    generationConfig: { responseMimeType: "application/json" },
});

const openaiClient = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;
const deepseekClient = DEEPSEEK_API_KEY ? new OpenAI({ baseURL: 'https://api.deepseek.com', apiKey: DEEPSEEK_API_KEY }) : null;

const OPENAI_MODEL = process.env.VITE_OPENAI_MODEL || "gpt-4o-mini";
const DEEPSEEK_MODEL = process.env.VITE_DEEPSEEK_MODEL || "deepseek-chat";

// Call finetuned FastAPI server with a hard timeout.
// Returns { answer, model_used, latency_ms } or throws on timeout/error.
const callFinetunedServer = async (modelName, question) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FINETUNED_TIMEOUT_MS);
    try {
        const t0 = Date.now();
        const resp = await fetch(FINETUNED_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question, model: modelName }),
            signal: controller.signal,
        });
        clearTimeout(timer);
        if (!resp.ok) throw new Error(`Finetuned server error: ${resp.status}`);
        const data = await resp.json();
        console.log(`[Finetuned] ${modelName} answered in ${Date.now() - t0}ms`);
        return data.answer;
    } catch (err) {
        clearTimeout(timer);
        if (err.name === 'AbortError') throw new Error(`TIMEOUT: finetuned-${modelName} exceeded ${FINETUNED_TIMEOUT_MS}ms`);
        throw err;
    }
};

// Wrap finetuned answer as JSON so it fits the existing generateContent contract.
// The finetuned model returns plain text, not structured JSON, so we wrap it.
const fineTunedToJson = (answer, key = 'answer') => ({ [key]: answer });

// Call a single provider and return parsed JSON. Throws on error.
const callProvider = async (provider, prompt) => {
    if (provider === 'openai') {
        if (!openaiClient) throw new Error("OpenAI API Key not configured");
        const completion = await openaiClient.chat.completions.create({
            messages: [
                { role: "system", content: "You are a helpful educational assistant. Output strictly valid JSON." },
                { role: "user", content: prompt }
            ],
            model: OPENAI_MODEL,
            response_format: { type: "json_object" },
        });
        return JSON.parse(cleanResponse(completion.choices[0].message.content));
    } else if (provider === 'deepseek') {
        if (!deepseekClient) throw new Error("Deepseek API Key not configured");
        const completion = await deepseekClient.chat.completions.create({
            messages: [
                { role: "system", content: "You are a helpful educational assistant. Output strictly valid JSON." },
                { role: "user", content: prompt }
            ],
            model: DEEPSEEK_MODEL,
            response_format: { type: "json_object" },
        });
        return JSON.parse(cleanResponse(completion.choices[0].message.content));
    } else if (provider === 'finetuned-deepseek' || provider === 'finetuned-mistral') {
        const modelName = provider === 'finetuned-deepseek' ? 'deepseek' : 'mistral';
        try {
            const answer = await callFinetunedServer(modelName, prompt);
            try { return JSON.parse(cleanResponse(answer)); } catch (_) {}
            return fineTunedToJson(answer);
        } catch (err) {
            if (err.message.startsWith('TIMEOUT') || err.message.includes('ECONNREFUSED')) {
                console.warn(`[Finetuned] ${err.message} — falling back to DeepSeek API`);
                if (!deepseekClient) throw new Error("Finetuned server unavailable and DeepSeek API Key not configured for fallback");
                const completion = await deepseekClient.chat.completions.create({
                    messages: [
                        { role: "system", content: "You are a helpful educational assistant. Output strictly valid JSON." },
                        { role: "user", content: prompt }
                    ],
                    model: DEEPSEEK_MODEL,
                    response_format: { type: "json_object" },
                });
                return JSON.parse(cleanResponse(completion.choices[0].message.content));
            }
            throw err;
        }
    } else {
        // gemini (default)
        const result = await geminiModel.generateContent(prompt);
        const response = await result.response;
        return JSON.parse(cleanResponse(response.text()));
    }
};

// Whether an error is a provider-level quota/billing issue worth falling back from
const isQuotaError = (err) => {
    const msg = (err?.message || '').toLowerCase();
    const status = err?.status || err?.statusCode || 0;
    return status === 429 || status === 402
        || msg.includes('429') || msg.includes('402')
        || msg.includes('quota') || msg.includes('rate limit')
        || msg.includes('insufficient balance') || msg.includes('insufficient_quota')
        || msg.includes('too many requests');
};

// Provider fallback chain: if the requested provider hits a quota/rate-limit,
// try the next available provider automatically rather than failing the request.
const FALLBACK_ORDER = ['openai', 'deepseek', 'gemini'];

const generateContent = async (provider, prompt) => {
    // Try requested provider first
    try {
        return await callProvider(provider, prompt);
    } catch (err) {
        if (!isQuotaError(err)) throw err; // non-quota errors surface immediately
        console.warn(`[AI Fallback] ${provider} quota hit (${err.message?.slice(0, 80)}). Trying fallbacks...`);
    }

    // Walk the fallback chain, skipping the already-tried provider
    for (const fallback of FALLBACK_ORDER) {
        if (fallback === provider) continue;
        try {
            console.log(`[AI Fallback] Trying ${fallback}...`);
            const result = await callProvider(fallback, prompt);
            console.log(`[AI Fallback] ${fallback} succeeded.`);
            return result;
        } catch (fallbackErr) {
            if (!isQuotaError(fallbackErr)) throw fallbackErr; // unexpected error — don't swallow it
            console.warn(`[AI Fallback] ${fallback} also quota-limited. Continuing...`);
        }
    }

    throw new Error("All configured AI providers are quota-limited or unavailable. Please add an API key to Backend/.env or try again later.");
};

// Protect wrapper
const asyncRoute = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// POST /api/ai/generate
router.post('/generate', asyncRoute(async (req, res) => {
    const { provider, prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "Missing prompt" });
    
    // Using a light retry pattern on the backend
    let lastError;
    for (let i = 0; i < 3; i++) {
        try {
            const data = await generateContent(provider || 'openai', prompt);
            return res.json(data);
        } catch (err) {
            lastError = err;
            if (err.message?.includes('503') || err.status === 429) {
                await new Promise(resolve => setTimeout(resolve, 2000));
                continue;
            }
            break;
        }
    }
    console.error("Backend LLM Error:", lastError);
    res.status(500).json({ error: "Failed to generate AI content", details: lastError ? lastError.message : "Unknown error" });
}));

const vectorDb = require('../services/vectorDb');
const { requireAuth } = require('../middleware/auth');

// Make sure the router requires auth if we want to extract user memory!
// We'll leave the base generator unprotected for fallback, but protect the RAG ones.

// POST /api/ai/ask-rag
router.post('/ask-rag', requireAuth, asyncRoute(async (req, res) => {
    const { provider, question } = req.body;
    if (!question) return res.status(400).json({ error: "Missing question" });

    // 1. Retrieve historical context from ChromaDB
    const context = await vectorDb.queryMemory(req.user.userId, question, 5);

    // 2. Synthesize prompt
    let prompt = `
Student Question: "${question}"

You are an expert personalized tutor possessing the student's exact learning memory and resources.
Below is the highly relevant contextual information extracted from the exact files the student previously uploaded.

PAST KNOWLEDGE / DOCUMENT CONTEXT:
${context ? `"""\n${context}\n"""` : "No specific relevant memory found in the database. Rely on general AI knowledge."}

INSTRUCTION: Answer the student's question accurately. If the PAST KNOWLEDGE contains the answer, deeply prioritize it with direct citations or mentions of the context. If it does not contain the answer, answer generally and helpfully.
Return as a JSON object with a key "answer" containing your raw markdown response.
`;

    // 3. Generate response using native tools
    let lastError;
    for (let i = 0; i < 3; i++) {
        try {
            const data = await generateContent(provider || 'openai', prompt);
            return res.json(data);
        } catch (err) {
            lastError = err;
            if (err.message?.includes('503') || err.status === 429) {
                await new Promise(resolve => setTimeout(resolve, 2000));
                continue;
            }
            break;
        }
    }
    console.error("Backend LLM Error:", lastError);
    res.status(500).json({ error: "Failed to generate AI content", details: lastError ? lastError.message : "Unknown error" });
}));

// GET /api/ai/stream-generate - Universal generic streaming endpoint for UI elements
router.post('/stream-generate', asyncRoute(async (req, res) => {
    const { provider, prompt } = req.body;
    if (!prompt) return res.status(400).end();

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Cache-Control', 'no-cache');
    res.flushHeaders();
    res.write(" ");

    try {
        if (provider === 'openai') {
            if (!openaiClient) throw new Error("OpenAI API Key not configured in .env");
            const stream = await openaiClient.chat.completions.create({
                model: OPENAI_MODEL,
                messages: [{ role: 'user', content: prompt }],
                stream: true,
            });
            for await (const chunk of stream) {
                res.write(chunk.choices[0]?.delta?.content || '');
            }
        } else if (provider === 'deepseek') {
            if (!deepseekClient) throw new Error("Deepseek API Key not configured in .env");
            const stream = await deepseekClient.chat.completions.create({
                model: DEEPSEEK_MODEL,
                messages: [{ role: 'user', content: prompt }],
                stream: true,
            });
            for await (const chunk of stream) {
                res.write(chunk.choices[0]?.delta?.content || '');
            }
        } else if (provider === 'finetuned-deepseek' || provider === 'finetuned-mistral') {
            // Finetuned models don't support streaming — call synchronously then write all at once
            const modelName = provider === 'finetuned-deepseek' ? 'deepseek' : 'mistral';
            let answer;
            try {
                answer = await callFinetunedServer(modelName, prompt);
            } catch (err) {
                if (err.message.startsWith('TIMEOUT') || err.message.includes('ECONNREFUSED')) {
                    console.warn(`[Finetuned stream-generate] ${err.message} — falling back to DeepSeek API`);
                    if (!deepseekClient) throw new Error("Finetuned server unavailable and DeepSeek API Key not configured for fallback");
                    const stream = await deepseekClient.chat.completions.create({
                        model: DEEPSEEK_MODEL,
                        messages: [{ role: 'user', content: prompt }],
                        stream: true,
                    });
                    for await (const chunk of stream) {
                        res.write(chunk.choices[0]?.delta?.content || '');
                    }
                    res.end();
                    return;
                }
                throw err;
            }
            res.write(answer);
        } else {
            // Default: try OpenAI stream first, fall back to Gemini
            const streamProviders = openaiClient
                ? [
                    async () => {
                        const stream = await openaiClient.chat.completions.create({ model: OPENAI_MODEL, messages: [{ role: 'user', content: prompt }], stream: true });
                        for await (const chunk of stream) res.write(chunk.choices[0]?.delta?.content || '');
                    },
                    async () => {
                        const streamModel = geminiClient.getGenerativeModel({ model: "gemini-2.0-flash" });
                        const result = await streamModel.generateContentStream(prompt);
                        for await (const chunk of result.stream) res.write(chunk.text());
                    },
                  ]
                : [
                    async () => {
                        const streamModel = geminiClient.getGenerativeModel({ model: "gemini-2.0-flash" });
                        const result = await streamModel.generateContentStream(prompt);
                        for await (const chunk of result.stream) res.write(chunk.text());
                    },
                  ];
            for (const tryProvider of streamProviders) {
                try { await tryProvider(); break; } catch (e) {
                    if (!isQuotaError(e)) throw e;
                    console.warn('[stream-generate fallback]', e.message?.slice(0, 60));
                }
            }
        }
        res.end();
    } catch (err) {
        console.error("Streaming error:", err);
        res.write(`\n\n*[Error: AI provider quota exceeded. Switch to OpenAI in the top-right dropdown.]*`);
        res.end();
    }
}));

// GET /api/ai/stream-rag - Streaming SSE endpoint for Chatbots
// Note: Must use GET or specific eventSource setups, or use generic POST with chunked Transfer-Encoding
router.post('/stream-rag', requireAuth, asyncRoute(async (req, res) => {
    const { provider, question } = req.body;
    if (!question) return res.status(400).end();

    console.log(`[Stream API] Initiating request for user ${req.user.userId}`);
    
    // Setup headers for standard Text streaming (not SSE, just direct piped chunks)
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Cache-Control', 'no-cache');
    res.flushHeaders(); // MUST flush so the browser understands the stream is active
    
    // We can yield a small invisible char or space to trigger the reader on the frontend
    res.write(" ");

    try {
        let context = "";
        try {
            console.log(`[Stream API] Querying VectorDB memory for context...`);
            context = await vectorDb.queryMemory(req.user.userId, question, 5);
            console.log(`[Stream API] VectorDB retrieved ${context.length} characters of context.`);
        } catch (dbErr) {
            console.error("[Stream API] Vector DB fetch failed during stream:", dbErr);
        }

        let prompt = `
Student Question: "${question}"

You are an expert personalized tutor possessing the student's exact learning memory and resources.
Below is the highly relevant contextual information extracted from the exact files the student previously uploaded.

PAST KNOWLEDGE / DOCUMENT CONTEXT:
${context ? `"""\n${context}\n"""` : "No specific relevant memory found in the database. Rely on general AI knowledge."}

INSTRUCTION: Answer the student's question accurately. If the PAST KNOWLEDGE contains the answer, deeply prioritize it with direct citations or mentions of the context. 
IMPORTANT: Stream directly in markdown. DO NOT wrap with \`\`\`json or output JSON objects.
`;      
        console.log(`[Stream API] Synthesized complete LLM prompt.`);
        
        let byteCount = 0;
        if (provider === 'openai') {
            if (!openaiClient) throw new Error("OpenAI API Key not configured in .env");
            const stream = await openaiClient.chat.completions.create({
                model: OPENAI_MODEL,
                messages: [{ role: 'user', content: prompt }],
                stream: true,
            });
            for await (const chunk of stream) {
                const textChunk = chunk.choices[0]?.delta?.content || '';
                byteCount += textChunk.length;
                res.write(textChunk);
            }
        } else if (provider === 'deepseek') {
            if (!deepseekClient) throw new Error("Deepseek API Key not configured in .env");
            const stream = await deepseekClient.chat.completions.create({
                model: DEEPSEEK_MODEL,
                messages: [{ role: 'user', content: prompt }],
                stream: true,
            });
            for await (const chunk of stream) {
                const textChunk = chunk.choices[0]?.delta?.content || '';
                byteCount += textChunk.length;
                res.write(textChunk);
            }
        } else if (provider === 'finetuned-deepseek' || provider === 'finetuned-mistral') {
            const modelName = provider === 'finetuned-deepseek' ? 'deepseek' : 'mistral';
            let answer;
            try {
                answer = await callFinetunedServer(modelName, question);
            } catch (err) {
                if (err.message.startsWith('TIMEOUT') || err.message.includes('ECONNREFUSED')) {
                    console.warn(`[Finetuned stream-rag] ${err.message} — falling back to DeepSeek API`);
                    if (!deepseekClient) throw new Error("Finetuned server unavailable and DeepSeek API Key not configured for fallback");
                    const stream = await deepseekClient.chat.completions.create({
                        model: DEEPSEEK_MODEL,
                        messages: [{ role: 'user', content: prompt }],
                        stream: true,
                    });
                    for await (const chunk of stream) {
                        const textChunk = chunk.choices[0]?.delta?.content || '';
                        byteCount += textChunk.length;
                        res.write(textChunk);
                    }
                    res.end();
                    console.log(`[Stream API] Fallback finished. Piped ${byteCount} bytes.`);
                    return;
                }
                throw err;
            }
            byteCount = answer.length;
            res.write(answer);
        } else {
            // Default: try OpenAI stream first, fall back to Gemini
            const streamProviders = openaiClient
                ? [
                    async () => {
                        const stream = await openaiClient.chat.completions.create({ model: OPENAI_MODEL, messages: [{ role: 'user', content: prompt }], stream: true });
                        for await (const chunk of stream) { const t = chunk.choices[0]?.delta?.content || ''; byteCount += t.length; res.write(t); }
                    },
                    async () => {
                        const streamModel = geminiClient.getGenerativeModel({ model: "gemini-2.0-flash" });
                        const result = await streamModel.generateContentStream(prompt);
                        for await (const chunk of result.stream) { const t = chunk.text(); byteCount += t.length; res.write(t); }
                    },
                  ]
                : [
                    async () => {
                        const streamModel = geminiClient.getGenerativeModel({ model: "gemini-2.0-flash" });
                        const result = await streamModel.generateContentStream(prompt);
                        for await (const chunk of result.stream) { const t = chunk.text(); byteCount += t.length; res.write(t); }
                    },
                  ];
            for (const tryProvider of streamProviders) {
                try { await tryProvider(); break; } catch (e) {
                    if (!isQuotaError(e)) throw e;
                    console.warn('[stream-rag fallback]', e.message?.slice(0, 60));
                }
            }
        }

        res.end();
        console.log(`[Stream API] Successfully finished stream. Piped ${byteCount} bytes.`);
    } catch (err) {
        console.error("[Stream API] Uncaught streaming error:", err);
        let userMessage = "Connection error while streaming AI response.";
        if (err.message && err.message.includes('429')) {
             userMessage = "Tutor AI free-tier quota exceeded. Please try again in a few seconds.";
        }
        res.write(`\n\n*[Error: ${userMessage}]*`);
        res.end();
    }
}));

module.exports = router;
