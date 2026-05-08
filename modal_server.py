"""
Professor in a Box — Modal Inference API
DATA 298B Team 2 | SJSU MSDA | Spring 2026

Deploy with:
    modal deploy modal_server.py

After deploy, Modal prints permanent URLs (example):
    Ask (batch):   https://<workspace>--piab-inference-inferenceserver-ask.modal.run
    Ask (stream):  https://<workspace>--piab-inference-inferenceserver-ask-stream.modal.run
    Health:        https://<workspace>--piab-inference-inferenceserver-health.modal.run

API Contract:
    POST /ask         Body: {"question": "...", "model": "mistral" | "deepseek"}
                      Response: {"answer": "...", "model_used": "...", "latency_ms": 123.4}

    POST /ask-stream  Body: {"question": "...", "model": "mistral" | "deepseek"}
                      Response: text/event-stream — SSE chunks:
                          data: {"token": "Hello"}\n\n
                          ...
                          data: [DONE]\n\n

    GET  /health      Response: {"status": "ok", "models_loaded": [...]}
"""

import modal
import time
import json

# ── App definition ─────────────────────────────────────────────────────────────
app = modal.App("piab-inference")

# ── Model weight cache volume ──────────────────────────────────────────────────
# Persists HuggingFace downloads across cold starts — no re-downloading on restart.
# First cold start: downloads models (~15-20 min). All subsequent cold starts: loads
# from volume (~60-90s instead of re-downloading).
model_volume = modal.Volume.from_name("piab-model-weights", create_if_missing=True)
MODEL_CACHE_DIR = "/model-cache"

# ── Container image ────────────────────────────────────────────────────────────
image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install([
        "transformers>=4.44.0,<5.0.0",
        "peft>=0.15.0",
        "accelerate>=0.33.0",
        "bitsandbytes>=0.43.0",
        "huggingface-hub>=0.23.0",
        "fastapi>=0.111.0",
        "pydantic>=2.0.0",
        "sentencepiece>=0.1.99",
        "protobuf>=3.20.0",
    ])
    .pip_install(["torch==2.3.0"], extra_index_url="https://download.pytorch.org/whl/cu118")
    # Point HuggingFace to the volume so weights are cached across cold starts
    .env({"HF_HOME": MODEL_CACHE_DIR, "TRANSFORMERS_CACHE": MODEL_CACHE_DIR})
)

# ── Model configuration ────────────────────────────────────────────────────────
MODEL_CONFIG = {
    "mistral": {
        "base":    "mistralai/Mistral-7B-Instruct-v0.3",
        "adapter": "BasanthPR/mistral7b-cs-tutor",
        "prompt":  "[INST] {q} [/INST]",
    },
    "deepseek": {
        "base":    "deepseek-ai/DeepSeek-R1-Distill-Qwen-7B",
        "adapter": "BasanthPR/deepseek-r1-7b-cs-tutor",
        "prompt":  "<|im_start|>user\n{q}<|im_end|>\n<|im_start|>assistant\n",
    },
}

# Default model loaded eagerly at cold start — must match what the demo uses most.
EAGER_MODEL = "deepseek"


@app.cls(
    # A10G has 24GB VRAM vs T4's 16GB — ~2-3x faster inference for 7B models
    gpu="A10G",
    memory=65536,
    image=image,
    timeout=600,
    # Cache model weights on the volume across cold starts
    volumes={MODEL_CACHE_DIR: model_volume},
    # Scale down 60s after last request — short enough to save money, long enough to avoid cold starts on back-to-back queries
    scaledown_window=60,
    startup_timeout=1200,
    # min_containers=0 — containers scale to zero when idle, no GPU cost between requests
    # Cold start is ~60-90s; acceptable for a demo. Set to 1 only during live presentations.
    min_containers=0,
    # enable_memory_snapshot=True,  # re-enable after volume is pre-populated
)
class InferenceServer:

    @modal.enter()
    def load_models(self):
        """
        Runs once per container lifetime (cold start).
        snap=True means Modal snapshots memory after this completes —
        subsequent cold starts skip re-loading and restore from snapshot.
        Cold start (first ever): ~60-90s. Warm requests: ~5-15s.
        Snapshot restores: ~10s.
        """
        import torch
        self.loaded = {}
        self._load_one(EAGER_MODEL)
        print(f"[INFO] Cold start complete. {EAGER_MODEL} ready.")

    def _load_one(self, name: str):
        """Load a single model into GPU memory (idempotent). Reads from volume cache."""
        if name in self.loaded:
            return
        from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
        from peft import PeftModel, LoraConfig
        from huggingface_hub import hf_hub_download
        import torch, json as _json

        _ROUTING_KEYS     = {"peft_type", "auto_mapping", "base_model_name_or_path", "revision"}
        _NONSTANDARD_KEYS = {"alora_invocation_tokens"}

        cfg = MODEL_CONFIG[name]
        print(f"[INFO] Loading {name}: {cfg['base']}")

        path = hf_hub_download(repo_id=cfg["adapter"], filename="adapter_config.json")
        with open(path) as f:
            raw = _json.load(f)
        cleaned = {k: v for k, v in raw.items() if k not in _ROUTING_KEYS | _NONSTANDARD_KEYS}
        lora_config = LoraConfig(**cleaned)

        bnb_cfg = BitsAndBytesConfig(
            load_in_4bit=True,
            bnb_4bit_quant_type="nf4",
            bnb_4bit_compute_dtype=torch.float16,
            bnb_4bit_use_double_quant=True,
        )
        tokenizer = AutoTokenizer.from_pretrained(cfg["base"])
        model = AutoModelForCausalLM.from_pretrained(
            cfg["base"],
            quantization_config=bnb_cfg,
            device_map="auto",
            torch_dtype=torch.float16,
        )
        model = PeftModel.from_pretrained(model, cfg["adapter"], config=lora_config)
        model.eval()
        self.loaded[name] = (tokenizer, model)
        print(f"[INFO] {name} ready.")

    # ── Batch endpoint ─────────────────────────────────────────────────────────
    @modal.fastapi_endpoint(method="POST")
    def ask(self, item: dict):
        """
        Batch inference — waits for full generation, returns JSON.
        POST {"question": "...", "model": "deepseek" | "mistral"}
        """
        import torch

        question   = item.get("question", "").strip()
        model_name = item.get("model", EAGER_MODEL).strip().lower()

        if not question:
            return {"error": "Field 'question' is required."}, 400
        if model_name not in MODEL_CONFIG:
            return {"error": f"Unknown model '{model_name}'.", "valid": list(MODEL_CONFIG)}, 400

        self._load_one(model_name)
        tokenizer, model = self.loaded[model_name]
        prompt = MODEL_CONFIG[model_name]["prompt"].format(q=question)
        inputs = tokenizer(prompt, return_tensors="pt").to("cuda")

        t0 = time.time()
        with torch.inference_mode():
            output_ids = model.generate(
                **inputs,
                max_new_tokens=512,
                temperature=0.6,
                do_sample=True,
                repetition_penalty=1.1,
                pad_token_id=tokenizer.eos_token_id,
            )
        latency_ms = (time.time() - t0) * 1000

        new_tokens = output_ids[0][inputs["input_ids"].shape[1]:]
        answer = tokenizer.decode(new_tokens, skip_special_tokens=True).strip()

        return {"answer": answer, "model_used": model_name, "latency_ms": round(latency_ms, 1)}

    # ── Streaming endpoint ─────────────────────────────────────────────────────
    @modal.fastapi_endpoint(method="POST")
    def ask_stream(self, item: dict):
        """
        Streaming inference — yields tokens via SSE as they are generated.
        POST {"question": "...", "model": "deepseek" | "mistral"}
        SSE format:  data: {"token": "..."}\n\n  ...  data: [DONE]\n\n
        """
        from transformers import TextIteratorStreamer
        from fastapi.responses import StreamingResponse
        import threading, torch

        question   = item.get("question", "").strip()
        model_name = item.get("model", EAGER_MODEL).strip().lower()

        if not question:
            def _err():
                yield 'data: {"error": "question required"}\n\n'
            return StreamingResponse(_err(), media_type="text/event-stream")

        if model_name not in MODEL_CONFIG:
            def _err():
                yield f'data: {{"error": "Unknown model {model_name}"}}\n\ndata: [DONE]\n\n'
            return StreamingResponse(_err(), media_type="text/event-stream")

        self._load_one(model_name)
        tokenizer, model = self.loaded[model_name]
        prompt = MODEL_CONFIG[model_name]["prompt"].format(q=question)
        inputs = tokenizer(prompt, return_tensors="pt").to("cuda")

        streamer = TextIteratorStreamer(
            tokenizer, skip_prompt=True, skip_special_tokens=True, timeout=120.0
        )
        gen_kwargs = dict(
            **inputs,
            max_new_tokens=512,
            temperature=0.6,
            do_sample=True,
            repetition_penalty=1.1,
            pad_token_id=tokenizer.eos_token_id,
            streamer=streamer,
        )

        thread = threading.Thread(target=model.generate, kwargs=gen_kwargs)
        thread.start()

        def sse_generator():
            try:
                for token_text in streamer:
                    if token_text:
                        yield f"data: {json.dumps({'token': token_text})}\n\n"
            except Exception as e:
                yield f"data: {json.dumps({'error': str(e)})}\n\n"
            finally:
                thread.join()
            yield "data: [DONE]\n\n"

        return StreamingResponse(sse_generator(), media_type="text/event-stream")

    # ── Health check ───────────────────────────────────────────────────────────
    @modal.fastapi_endpoint(method="GET")
    def health(self):
        return {
            "status":           "ok",
            "models_loaded":    list(self.loaded.keys()),
            "models_available": list(MODEL_CONFIG.keys()),
        }


# ── Local test entry point ─────────────────────────────────────────────────────
@app.local_entrypoint()
def main():
    print("modal_server.py loaded. Deploy with: modal deploy modal_server.py")
