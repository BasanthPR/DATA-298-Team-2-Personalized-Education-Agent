# 🏗️ Personalized Education Agent: Architecture Overview

This document outlines the full-stack transformation of the Personalized Education Agent. The architecture is designed for **Security**, **Privacy**, and **Semantic Intelligence**.

---

## 🚀 The Stack
- **Frontend:** React + Vite + React Router (Client-side logic & UI)
- **Backend:** Node.js + Express (API Layer & Security Proxy)
- **Primary Database:** SQLite + Prisma ORM (User accounts, Course metadata, Chat history)
- **Vector Database:** ChromaDB (Semantic memory & Retrieval-Augmented Generation)
- **AI Core:** Google Gemini (Generation & Embeddings), LlamaCloud (File Parsing)

---

## 🔒 Security & Auth Flow
1. **JWT Authentication:** All sensitive API calls (AI, Database, Uploads) are protected by a `requireAuth` middleware.
2. **Encrypted Storage:** Passwords are never stored in plain text; they are hashed using `bcrypt` before hitting the database.
3. **Backend Proxy:** API keys for Gemini, OpenAI, and LlamaParse are **never exposed** to the browser. They reside strictly on the server in a `.env` file.

---

## 🧠 AI & Semantic Memory (RAG)
The "Brain" of the application follows a **Retrieval-Augmented Generation (RAG)** pattern:

### 1. The Learning Phase (Write)
- **File Upload:** Uploaded files (PDFs/Images) are parsed into Markdown via **LlamaCloud**.
- **Chunking:** Large documents are sliced into ~800-character conceptual chunks.
- **Embedding:** Chunks are sent to the **Gemini Embedding API** (`text-embedding-004`) to be converted into mathematical vectors.
- **ChromaDB Storage:** These vectors are stored in a local **ChromaDB** instance on the server.

### 2. The Retrieval Phase (Read)
- **Semantic Search:** When a user asks a question, the question is converted into a vector.
- **Memory Lookup:** The system finds the most similar chunks in ChromaDB.
- **Context Injection:** The LLM receives the question along with the *exact paragraphs* from the student's uploaded files to generate a factual, context-aware answer.

---

## 📁 Project Structure Highlights
```text
/Backend
  ├── /routes        # Express API endpoints (Auth, Paths, AI, Uploads, Chats)
  ├── /middleware    # Security (JWT checking)
  ├── /services      # LLM logic & Vector DB (ChromaDB) interface
  ├── /prisma        # Relational schema (SQLite)
/Frontend
  ├── /src/context   # Global State (Auth status & Learning Paths)
  ├── /src/services  # Backend API bridge
  ├── /src/pages     # Component views (Dashboard, Detail, Quiz)
```

---

## ✅ Feature Checklist Implemented
- [x] **Full-Stack Sync:** All paths and milestones persist across browser refreshes.
- [x] **Secure Uploads:** Local file handling via `multer`.
- [x] **OCR Integration:** Multi-modal support (images/PDFs) via LlamaParse.
- [x] **Persistent Chat:** Historical Q&A is saved to the SQLite database.
- [x] **Route Protection:** Users must login to see their private learning data.
- [x] **Vector Memory:** AI "remembers" the specific content of uploaded documents.
