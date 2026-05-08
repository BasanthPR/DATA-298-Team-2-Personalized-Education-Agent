const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { requireAuth } = require('../middleware/auth');
const vectorDb = require('../services/vectorDb');

const router = express.Router();

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir);
}

// Configure local multer storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir)
  },
  filename: function (req, file, cb) {
    // Save file with a unique timestamp + original name
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname)
  }
});

const upload = multer({ storage: storage });
const asyncRoute = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.use(requireAuth);

router.post('/document', upload.single('file'), asyncRoute(async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    const API_KEY = process.env.VITE_LLAMAPARSE_API_KEY;
    if (!API_KEY) {
        return res.status(500).json({ error: 'LlamaParse API Key missing on backend' });
    }

    // 1. Upload to LlamaCloud from the backend
    const formData = new FormData();
    // In Node.js environment with native fetch, we need to pass a Blob or file stream to FormData
    // Node 18+ has native fetch/FormData, however reading a file into FormData requires Blob construction
    // Instead of completely native, let's just proxy the file stream
    
    // A simpler trick for Backend LlamaParse is just returning the local path to the frontend for now, 
    // but the architectural plan was to parse it here.
    const fileBuffer = fs.readFileSync(req.file.path);
    const blob = new Blob([fileBuffer], { type: req.file.mimetype });
    formData.append("file", blob, req.file.originalname);

    try {
        const uploadRes = await fetch('https://api.cloud.llamaindex.ai/api/parsing/upload', {
            method: 'POST',
            headers: {
                'accept': 'application/json',
                'Authorization': `Bearer ${API_KEY}`
            },
            body: formData
        });

        if (!uploadRes.ok) throw new Error(`Upload failed: ${uploadRes.statusText}`);
        const uploadData = await uploadRes.json();
        const jobId = uploadData.id;

        // 2. Poll for completion
        let status = 'PENDING';
        while (status === 'PENDING') {
            await new Promise(resolve => setTimeout(resolve, 2000));
            const statusRes = await fetch(`https://api.cloud.llamaindex.ai/api/parsing/job/${jobId}`, {
                headers: { 'accept': 'application/json', 'Authorization': `Bearer ${API_KEY}` }
            });
            if (!statusRes.ok) throw new Error(`Status check failed: ${statusRes.statusText}`);
            const statusData = await statusRes.json();
            status = statusData.status;

            if (status === 'ERROR') throw new Error("LlamaParse parsing error.");
        }

        // 3. Fetch markdown result
        const resultRes = await fetch(`https://api.cloud.llamaindex.ai/api/parsing/job/${jobId}/result/markdown`, {
            headers: { 'accept': 'application/json', 'Authorization': `Bearer ${API_KEY}` }
        });

        if (!resultRes.ok) throw new Error(`Failed to fetch parsed markdown`);
        const resultData = await resultRes.json();
        
        // 4. Extract Text & Push exactly into Semantic Memory 
        // Note: Done asynchronously to not block the immediate JSON response to the user
        vectorDb.saveDocument(req.user.userId, req.file.originalname, resultData.markdown)
            .catch(err => console.error("ChromaDB Background Save Error:", err));

        // Pass back the local file URL and the extracted markdown!
        res.json({ 
            message: 'File secured locally and successfully parsed by LlamaCloud!',
            localFilePath: `/uploads/${req.file.filename}`,  // local path mapped
            markdown: resultData.markdown 
        });

    } catch (error) {
        console.error("Backend LlamaParse Error:", error);
        res.status(500).json({ error: 'Failed to process document with LlamaParse' });
    }
}));

module.exports = router;
