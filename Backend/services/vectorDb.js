const { ChromaClient } = require('chromadb');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { v4: uuidv4 } = require('uuid');

const GEMINI_API_KEY = process.env.VITE_GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// Default endpoint for Chroma backend is http://localhost:8000
const client = new ChromaClient({ path: process.env.CHROMA_URL || "http://localhost:8000" });

// Helper function to create embeddings using Google Gemini
async function embedText(text) {
    if (!GEMINI_API_KEY) throw new Error("Gemini API Key missing for embeddings");
    const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
    const result = await model.embedContent(text);
    return result.embedding.values;
}

// Simple chunking algorithm
function chunkText(text, maxChars = 1000) {
    const chunks = [];
    let i = 0;
    while (i < text.length) {
        let end = i + maxChars;
        // Try to break at a newline or period if possible
        if (end < text.length) {
            let nextNewLine = text.lastIndexOf('\n', end);
            let nextPeriod = text.lastIndexOf('. ', end);
            if (nextNewLine > i) end = nextNewLine + 1;
            else if (nextPeriod > i) end = nextPeriod + 2;
        }
        chunks.push(text.substring(i, end).trim());
        i = end;
    }
    return chunks;
}

const vectorDb = {
    async initialize() {
        try {
            await client.heartbeat();
            console.log("Vector DB connected successfully!");
        } catch (e) {
            console.warn("ChromaDB Server is not running on port 8000. Vector functionalities will be skipped until it is started.");
        }
    },

    // Save uploaded file content into semantic memory
    async saveDocument(userId, filename, markdownContent) {
        try {
            console.log(`[VectorDB] Initiating semantic storage for file: ${filename} (User: ${userId})`);
            const collection = await client.getOrCreateCollection({ name: `user_${userId}_documents` });
            
            const chunks = chunkText(markdownContent, 800); 
            console.log(`[VectorDB] Document chunked into ${chunks.length} sections.`);
            
            for (let i = 0; i < chunks.length; i++) {
                const chunk = chunks[i];
                if (!chunk) continue;

                process.stdout.write(`[VectorDB] Generating embedding for chunk ${i+1}/${chunks.length}... `);
                const vector = await embedText(chunk);
                process.stdout.write(`Done.\n`);

                await collection.add({
                    ids: [uuidv4()],
                    embeddings: [vector],
                    metadatas: [{ source: filename, chunkIndex: i }],
                    documents: [chunk]
                });
            }
            console.log(`[VectorDB] SUCCESS: Successfully saved ${chunks.length} vectorized chunks to ChromaDB.`);
        } catch (e) {
            console.error("[VectorDB] ERROR: Failed to save to Vector DB:", e.message);
        }
    },

    // Query Semantic Memory
    async queryMemory(userId, question, topK = 3) {
        try {
            console.log(`[VectorDB] Searching memory for: "${question}" (User: ${userId})`);
            const collection = await client.getCollection({ name: `user_${userId}_documents` });
            
            console.log(`[VectorDB] Generating search vector for question...`);
            const searchVector = await embedText(question);

            console.log(`[VectorDB] Querying collection with retrieved vector...`);
            const results = await collection.query({
                queryEmbeddings: [searchVector],
                nResults: topK
            });

            // Flatten results
            if (results.documents && results.documents[0]) {
                const docCount = results.documents[0].length;
                console.log(`[VectorDB] SUCCESS: Found ${docCount} highly relevant context chunks!`);
                return results.documents[0].join("\n\n---\n\n");
            }
            console.log(`[VectorDB] DEBUG: No relevant memory matches found.`);
            return "";

        } catch (e) {
            console.warn(`[VectorDB] WARNING: No collection found for User: ${userId}. Returning empty context.`);
            return "";
        }
    }
};

module.exports = vectorDb;
