# Professor in a Box (PiAB)

**Personalized Education Agent — DATA 298B Capstone · SJSU MSDA · Team 2 · Spring 2026**

[![Report](https://img.shields.io/badge/docs-Final_Report-blue)](docs/Final_Report.pdf)
[![Poster](https://img.shields.io/badge/docs-Poster-green)](docs/Poster.pdf)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Deploy: Render](https://img.shields.io/badge/deploy-Render-46E3B7)](https://render.com)
[![Inference: Modal](https://img.shields.io/badge/inference-Modal_A10G-purple)](https://modal.com)

PiAB is an end-to-end AI tutoring system that fine-tunes open-weight LLMs on computer science Q&A corpora and serves them via a production RAG pipeline. Students upload their study materials; the system retrieves semantically relevant context and generates personalized, pedagogically grounded answers — streamed token-by-token from LoRA-adapted Mistral 7B and DeepSeek-R1 7B models running on serverless A10G GPUs.

---

## Table of Contents

1. [Research Context](#research-context)
2. [System Architecture](#system-architecture)
3. [Models & Fine-Tuning](#models--fine-tuning)
4. [Data Pipeline (ETL)](#data-pipeline-etl)
5. [RAG Pipeline](#rag-pipeline)
6. [Tech Stack](#tech-stack)
7. [Repository Structure](#repository-structure)
8. [Quick Start — Local Development](#quick-start--local-development)
9. [API Reference](#api-reference)
10. [Deployment](#deployment)
11. [CI / CD](#ci--cd)
12. [Team](#team)

---

## Research Context

Large language models exhibit strong average-case performance but struggle with low-frequency CS sub-domains and tend to hallucinate on domain-specific questions. PiAB addresses this with two complementary techniques:

1. **Supervised fine-tuning with LoRA** — adapts Mistral-7B-Instruct-v0.3 and DeepSeek-R1-Distill-Qwen-7B to CS tutoring style using curated Q&A datasets (LeetCode, Codeforces, APPS, CS textbooks).
2. **Retrieval-Augmented Generation** — augments every inference call with student-specific context extracted from uploaded notes/PDFs, reducing hallucination on personal study material.

See [`docs/Final_Report.pdf`](docs/Final_Report.pdf) for full experimental results and [`docs/Poster.pdf`](docs/Poster.pdf) for the conference-style poster.

---

## System Architecture

```
                         ┌─────────────────────────────────────────────┐
                         │              React + Vite Frontend           │
                         │   Auth · Dashboard · Learning Path · Quiz   │
                         └────────────────────┬────────────────────────┘
                                              │  HTTPS / SSE streaming
                         ┌────────────────────▼────────────────────────┐
                         │        Node.js + Express API Gateway         │
                         │  JWT Auth · Rate-limit · Provider fallback   │
                         └──────┬──────────────┬────────────────┬───────┘
                                │              │                │
               ┌────────────────▼──┐  ┌────────▼───────┐  ┌───▼──────────────┐
               │  SQLite + Prisma  │  │   ChromaDB     │  │  Modal Inference  │
               │  Users · Chats    │  │  Vector store  │  │  (A10G serverless)│
               │  Learning paths   │  │  RAG memory    │  │  Mistral 7B       │
               └───────────────────┘  └────────────────┘  │  DeepSeek-R1 7B  │
                                                           └──────────────────┘
                                                                    │ fallback
                                              ┌─────────────────────▼──────────┐
                                              │   Cloud AI Fallback Chain       │
                                              │   OpenAI gpt-4o-mini →          │
                                              │   DeepSeek-chat →               │
                                              │   Gemini 2.0 Flash              │
                                              └────────────────────────────────┘
```

**Request lifecycle (stream-RAG path):**

1. Student asks a question; frontend opens a chunked SSE stream to `/api/ai/stream-rag`.
2. API Gateway retrieves the top-5 semantically similar chunks from ChromaDB (per-user namespace).
3. Retrieved context + question are injected into a structured prompt.
4. The prompt is forwarded to the selected provider; tokens are streamed back to the client in real time.
5. If the primary provider returns 401/429/402, the gateway automatically falls back through OpenAI → DeepSeek → Gemini without surfacing an error to the user.

---

## Models & Fine-Tuning

| Model | Base | Adapter | HuggingFace Hub |
|---|---|---|---|
| **Mistral CS Tutor** | `mistralai/Mistral-7B-Instruct-v0.3` | LoRA rank-16 | `BasanthPR/mistral7b-cs-tutor` |
| **DeepSeek-R1 CS Tutor** | `deepseek-ai/DeepSeek-R1-Distill-Qwen-7B` | LoRA rank-16 | `BasanthPR/deepseek-r1-7b-cs-tutor` |

**Training recipe:**
- **Quantization:** 4-bit NF4 (BitsAndBytes `bnb_4bit_quant_type="nf4"`, double quant enabled) — reduces each 14 GB model to ~4 GB VRAM footprint.
- **Adapter:** PEFT LoRA via Hugging Face `peft` library.
- **Data:** Multi-source CS Q&A — LeetCode problems, Codeforces editorial-style explanations, APPS dataset, CS textbook chapters.
- **EDA notebooks:** [`EDA/`](EDA/) — per-dataset distribution analysis, token length histograms, label balance.
- **Processing notebooks:** [`Data Processing/`](Data%20Processing/) — deduplication, prompt formatting, train/val splits.

**Inference config (Modal):**
- GPU: NVIDIA A10G (24 GB VRAM)
- Batch endpoint (`POST /ask`) — waits for full generation, returns JSON.
- Streaming endpoint (`POST /ask-stream`) — SSE token stream; client receives `data: {"token": "..."}` lines.
- Cold start: ~60–90 s (weights loaded from Modal Volume cache). Warm requests: ~5–15 s.
- `min_containers=0`: scales to zero when idle; no GPU cost between requests.

---

## Data Pipeline (ETL)

[`ETL/`](ETL/) contains Apache Airflow DAGs that orchestrate dataset ingestion and preprocessing.

| DAG | Description |
|---|---|
| `multiple_datasets_etl.py` | Pulls raw CS Q&A datasets from Hugging Face Hub, normalizes schema, writes parquet. |
| `main.py` | Orchestrates full pipeline: ingest → deduplicate → format → upload to training bucket. |

Local Airflow dev environment uses [Astronomer CLI](https://docs.astronomer.io/astro/cli/overview).

---

## RAG Pipeline

The vector memory layer (`Backend/services/vectorDb.js`) uses **ChromaDB** with per-user collection namespacing:

1. **Ingest** — uploaded file (PDF/image) is parsed to Markdown via **LlamaCloud** (LlamaParse API).
2. **Chunk** — document is split into ~800-character semantic chunks with 100-character overlap.
3. **Embed** — chunks are embedded with **Gemini `text-embedding-004`** and stored in ChromaDB keyed by `userId`.
4. **Retrieve** — at query time, the question is embedded and the top-5 nearest chunks are fetched.
5. **Generate** — retrieved context is injected into the system prompt; the LLM answers with direct citations.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, Vite, React Router, Tailwind CSS, Mermaid.js |
| **Backend** | Node.js 20, Express 4, Prisma ORM |
| **Database** | SQLite (user data, chat history, learning paths) |
| **Vector DB** | ChromaDB (semantic document memory) |
| **Document parsing** | LlamaCloud (LlamaParse) — multi-modal PDF/image OCR |
| **Embeddings** | Gemini `text-embedding-004` |
| **Fine-tuned inference** | Modal (serverless A10G), Hugging Face Transformers, PEFT, BitsAndBytes |
| **Cloud AI fallback** | OpenAI `gpt-4o-mini`, DeepSeek-chat, Gemini 2.0 Flash |
| **Auth** | JWT (bcrypt hashed passwords, `requireAuth` middleware) |
| **Deployment** | Render (backend + frontend static), Modal (inference) |
| **ETL** | Apache Airflow (Astronomer runtime) |
| **CI** | GitHub Actions |

---

## Repository Structure

```
professor-in-a-box/
├── Backend/                   # Node.js + Express API
│   ├── routes/
│   │   ├── ai.js              # Multi-provider AI: streaming, RAG, fallback chain
│   │   ├── chats.js           # Persistent chat history
│   │   ├── paths.js           # Learning path CRUD
│   │   └── uploads.js         # File ingest → LlamaParse → ChromaDB
│   ├── services/
│   │   └── vectorDb.js        # ChromaDB client (embed, store, retrieve)
│   ├── middleware/
│   │   └── auth.js            # JWT requireAuth middleware
│   ├── prisma/
│   │   └── schema.prisma      # SQLite schema (User, Chat, LearningPath)
│   └── Dockerfile
├── Frontend/                  # React + Vite SPA
│   └── src/
│       ├── pages/             # Dashboard, CreatePath, MilestoneDetail, Quiz
│       ├── components/        # AI chat, learning path nodes, quiz cards
│       ├── context/           # LearningPathContext (global state)
│       └── services/          # API bridge, LLM service, config
├── ETL/                       # Apache Airflow DAGs
│   └── dags/
│       ├── multiple_datasets_etl.py
│       └── main.py
├── EDA/                       # Exploratory data analysis notebooks
├── Data Processing/           # Dataset cleaning and prompt-formatting notebooks
├── modal_server.py            # Modal inference server (A10G, Mistral + DeepSeek)
├── server.py                  # EC2 inference server (T4 variant, with CloudWatch logging)
├── render.yaml                # Render deployment manifest (backend + frontend)
├── docs/
│   ├── Final_Report.pdf       # DATA 298B final report
│   └── Poster.pdf             # Conference-style project poster
└── .github/
    └── workflows/
        └── deploy-frontend.yml
```

---

## Quick Start — Local Development

**Requirements:** Node.js 20+, Python 3.11+, Docker

### 1. Clone and install dependencies

```bash
git clone https://github.com/BasanthPR/DATA-298-Team-2-Personalized-Education-Agent.git
cd DATA-298-Team-2-Personalized-Education-Agent
```

### 2. Backend setup

```bash
cd Backend
cp .env.example .env          # fill in API keys (see .env.example for keys needed)
npm install
npx prisma migrate dev        # creates SQLite schema
node index.js                 # starts on :4000
```

Required env vars:
```
VITE_GEMINI_API_KEY=...       # Google AI Studio
VITE_OPENAI_API_KEY=...       # OpenAI (optional — Gemini is the default fallback)
VITE_DEEPSEEK_API_KEY=...     # DeepSeek (optional)
LLAMA_CLOUD_API_KEY=...       # LlamaCloud (for file upload / OCR)
JWT_SECRET=...                # any random string
FINETUNED_ASK_URL=...         # Modal inference URL (optional)
FINETUNED_STREAM_URL=...      # Modal streaming URL (optional)
```

### 3. Frontend setup

```bash
cd Frontend
npm install
npm run dev                   # starts on :5173
```

### 4. Modal inference (optional — requires Modal account)

```bash
pip install modal
modal deploy modal_server.py
# Modal prints permanent URLs for /ask, /ask-stream, /health, /config
# Set these as FINETUNED_* env vars in the backend
```

---

## API Reference

Base URL (local): `http://localhost:4000/api`

### Auth

| Method | Endpoint | Body | Description |
|---|---|---|---|
| `POST` | `/auth/register` | `{name, email, password}` | Create account |
| `POST` | `/auth/login` | `{email, password}` | Returns JWT |

### AI — Inference & RAG

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/ai/generate` | No | Batch JSON generation (path/quiz content) |
| `POST` | `/ai/stream-generate` | No | SSE streaming (plain text) |
| `POST` | `/ai/ask-rag` | JWT | Batch RAG answer from user's document memory |
| `POST` | `/ai/stream-rag` | JWT | Streaming RAG (SSE) with document context injection |
| `GET` | `/ai/warmup` | No | Pre-warm Modal container before demo |
| `GET` | `/ai/refresh` | No | Force-reload API keys from Modal secret store |

`POST /ai/stream-rag` body:
```json
{ "provider": "finetuned-deepseek", "question": "Explain dynamic programming" }
```
Valid `provider` values: `gemini` · `openai` · `deepseek` · `finetuned-mistral` · `finetuned-deepseek`

### Learning Paths

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/paths` | JWT | List user's learning paths |
| `POST` | `/paths` | JWT | Create a new path (AI-generated milestones) |
| `GET` | `/paths/:id` | JWT | Get path with milestones |
| `PUT` | `/paths/:id` | JWT | Update path |

### Chat History

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/chats/:milestoneId` | JWT | Fetch saved Q&A for a milestone |
| `POST` | `/chats` | JWT | Persist a Q&A exchange |

### File Uploads

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/uploads` | JWT | Upload PDF/image → parse → embed → store in ChromaDB |

---

## Deployment

The system is split across two platforms:

### Render — Web Services

`render.yaml` defines:

| Service | Type | Description |
|---|---|---|
| `piab-backend` | Docker web service | Node.js API + Prisma + ChromaDB, 1 GB persistent disk |
| `piab-frontend` | Static site | Vite build, SPA rewrite rules |

To deploy: push to `main` — Render auto-deploys from the manifest.

### Modal — Serverless GPU Inference

```bash
modal deploy modal_server.py
```

- Scales to zero between requests (no GPU cost when idle).
- First cold start downloads model weights (~15–20 min); subsequent cold starts load from Modal Volume (~60–90 s).
- API keys for cloud providers are stored as Modal Secrets and fetched by the backend at runtime — no secrets in environment variables or source code.

**Pre-warming for live demos:**

```bash
curl https://<your-backend>/api/ai/warmup
# Hit this ~90 seconds before the demo; container stays warm for 60 s after last request
```

---

## CI / CD

`.github/workflows/deploy-frontend.yml` — triggers on push to `main`, builds the Vite bundle and deploys to Render static hosting.

---

## Team

**SJSU MSDA — DATA 298B Team 2 — Spring 2026**

| Name | Role |
|---|---|
| Basanth Periyapatna Roopakumar | Backend · Inference · Deployment |
| *(teammates)* | Frontend · ETL · Data · EDA |

---

## Citation

If you reference this work, please cite:

```bibtex
@misc{piab2026,
  title     = {Professor in a Box: Personalized CS Tutoring via Fine-Tuned LLMs and RAG},
  author    = {Periyapatna Roopakumar, Basanth and {SJSU MSDA Team 2}},
  year      = {2026},
  note      = {DATA 298B Capstone, San José State University},
  url       = {https://github.com/BasanthPR/DATA-298-Team-2-Personalized-Education-Agent}
}
```

---

## License

MIT — see [LICENSE](LICENSE) for details.
