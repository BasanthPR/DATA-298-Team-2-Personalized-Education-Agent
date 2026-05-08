"""
Professor in a Box — Inference API
DATA 298B Team 2 | SJSU MSDA | Spring 2026

Serves two fine-tuned models via FastAPI:
  POST /ask   {"question": "...", "model": "mistral" | "deepseek"}
  GET  /health

Deploy on EC2 g4dn.xlarge (T4, 16 GB VRAM).
Both models at 4-bit quantization use ~8 GB total — fits comfortably.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import torch
import time
import boto3
import json
from datetime import datetime
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
from peft import PeftModel

app = FastAPI(
    title="Professor in a Box — Inference API",
    description="CS tutoring inference server. Serves Mistral-7B (general) and DeepSeek-R1-7B (reasoning).",
    version="1.0.0",
)

# CORS — allows the frontend (different domain/port) to call this API from a browser
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)

# ── Model configuration ────────────────────────────────────────────────────────
# Set adapter to None if no fine-tuned adapter is available for a model.
MODEL_CONFIG = {
    "mistral": {
        "base":    "mistralai/Mistral-7B-Instruct-v0.3",
        "adapter": "sjsu-team2-piab/mistral7b-cs-tutor",
        "prompt":  "[INST] {q} [/INST]",
    },
    "deepseek": {
        "base":    "deepseek-ai/DeepSeek-R1-Distill-Qwen-7B",
        "adapter": "sjsu-team2-piab/deepseek-r1-7b-cs-tutor",
        "prompt":  "<|im_start|>user\n{q}<|im_end|>\n<|im_start|>assistant\n",
    },
}

# 4-bit quantization: reduces each ~14 GB model to ~4 GB VRAM with minimal quality loss
bnb_cfg = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_quant_type="nf4",
    bnb_4bit_use_double_quant=True,
)

# Model cache — loaded once, stays in GPU memory for subsequent requests
loaded_models: dict = {}


def load_model(name: str):
    """Load a model into GPU memory and cache it. Lazy-loads on first request."""
    if name not in loaded_models:
        cfg = MODEL_CONFIG[name]
        print(f"[INFO] Loading {name} from {cfg['base']} ...")
        tokenizer = AutoTokenizer.from_pretrained(cfg["base"])
        model = AutoModelForCausalLM.from_pretrained(
            cfg["base"],
            quantization_config=bnb_cfg,
            device_map="auto",
        )
        if cfg["adapter"]:
            print(f"[INFO] Applying LoRA adapter: {cfg['adapter']}")
            model = PeftModel.from_pretrained(model, cfg["adapter"])
        loaded_models[name] = (tokenizer, model)
        print(f"[INFO] {name} ready.")
    return loaded_models[name]


# ── CloudWatch logging ─────────────────────────────────────────────────────────
try:
    log_client = boto3.client("logs", region_name="us-east-1")
except Exception:
    log_client = None

LOG_GROUP  = "/piab/inference"
LOG_STREAM = "requests"


def log_to_cloudwatch(question: str, model: str, latency_ms: float):
    """Write one log entry to CloudWatch. Never raises — logging must not crash inference."""
    if not log_client:
        return
    try:
        log_client.put_log_events(
            logGroupName=LOG_GROUP,
            logStreamName=LOG_STREAM,
            logEvents=[{
                "timestamp": int(datetime.now().timestamp() * 1000),
                "message": json.dumps({
                    "question_length": len(question),
                    "model": model,
                    "latency_ms": round(latency_ms, 1),
                }),
            }],
        )
    except Exception:
        pass


# ── Request / response schema ──────────────────────────────────────────────────
class AskRequest(BaseModel):
    question: str
    model: str = "mistral"  # default to mistral if caller doesn't specify


class AskResponse(BaseModel):
    answer: str
    model_used: str
    latency_ms: float


# ── Endpoints ──────────────────────────────────────────────────────────────────
@app.post("/ask", response_model=AskResponse)
def ask(req: AskRequest):
    """
    Main inference endpoint.
    Accepts a question and a model name ('mistral' or 'deepseek').
    Returns the model's answer and the time taken in milliseconds.
    """
    if req.model not in MODEL_CONFIG:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown model '{req.model}'. Valid options: {list(MODEL_CONFIG.keys())}",
        )

    tokenizer, model = load_model(req.model)
    prompt = MODEL_CONFIG[req.model]["prompt"].format(q=req.question)
    inputs = tokenizer(prompt, return_tensors="pt").to("cuda")

    t0 = time.time()
    with torch.inference_mode():
        output_ids = model.generate(
            **inputs,
            max_new_tokens=512,
            temperature=0.7,
            do_sample=True,
            pad_token_id=tokenizer.eos_token_id,
        )
    latency_ms = (time.time() - t0) * 1000

    # Decode only the newly generated tokens (strip the prompt)
    new_tokens = output_ids[0][inputs["input_ids"].shape[1]:]
    answer = tokenizer.decode(new_tokens, skip_special_tokens=True).strip()

    log_to_cloudwatch(req.question, req.model, latency_ms)

    return AskResponse(
        answer=answer,
        model_used=req.model,
        latency_ms=round(latency_ms, 1),
    )


@app.get("/health")
def health():
    """
    Health check endpoint.
    Returns server status and which models are currently loaded in GPU memory.
    """
    return {
        "status": "ok",
        "models_loaded": list(loaded_models.keys()),
        "models_available": list(MODEL_CONFIG.keys()),
    }


# ── Entry point (for local testing only — on EC2 use uvicorn via CLI) ─────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
