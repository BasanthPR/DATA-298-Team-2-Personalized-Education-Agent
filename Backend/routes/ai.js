const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const OpenAI = require('openai');

const router = express.Router();

const GEMINI_API_KEY = process.env.VITE_GEMINI_API_KEY;
const OPENAI_API_KEY = process.env.VITE_OPENAI_API_KEY;
const DEEPSEEK_API_KEY = process.env.VITE_DEEPSEEK_API_KEY;

// Clean markdown from LLM
const cleanResponse = (text) => text.replace(/```json/g, "").replace(/```/g, "").trim();

// Providers Initialization
const geminiClient = new GoogleGenerativeAI(GEMINI_API_KEY);
const geminiModel = geminiClient.getGenerativeModel({
    model: "gemini-flash-latest",
    generationConfig: { responseMimeType: "application/json" },
});

const openaiClient = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;
const deepseekClient = DEEPSEEK_API_KEY ? new OpenAI({ baseURL: 'https://api.deepseek.com', apiKey: DEEPSEEK_API_KEY }) : null;

const OPENAI_MODEL = process.env.VITE_OPENAI_MODEL || "gpt-4o-mini";
const DEEPSEEK_MODEL = process.env.VITE_DEEPSEEK_MODEL || "deepseek-chat";

// Universal Generate Function
const generateContent = async (provider, prompt) => {
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
    } else {
        // Fallback or explicit gemini
        const result = await geminiModel.generateContent(prompt);
        const response = await result.response;
        return JSON.parse(cleanResponse(response.text()));
    }
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
            const data = await generateContent(provider || 'gemini', prompt);
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
            const data = await generateContent(provider || 'gemini', prompt);
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
        } else {
            const streamModel = geminiClient.getGenerativeModel({ model: "gemini-flash-latest" }); 
            const result = await streamModel.generateContentStream(prompt);
            for await (const chunk of result.stream) {
                res.write(chunk.text());
            }
        }
        res.end();
    } catch (err) {
        console.error("Streaming error:", err);
        let userMessage = "Connection error while streaming AI response.";
        if (err.message && err.message.includes('429')) {
             userMessage = "Tutor AI free-tier quota exceeded. Please try again in a few seconds.";
        }
        res.write(`\n\n*[Error: ${userMessage}]*`);
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
        } else {
            const streamModel = geminiClient.getGenerativeModel({ model: "gemini-flash-latest" }); 
            const result = await streamModel.generateContentStream(prompt);
            for await (const chunk of result.stream) {
                const textChunk = chunk.text();
                byteCount += textChunk.length;
                res.write(textChunk);
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
