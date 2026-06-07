"""
Professor in a Box — HuggingFace Spaces Demo UI
DATA 298B Team 2 | SJSU MSDA | Spring 2026

This Gradio app is the public-facing demo interface.
It runs on HF Spaces FREE CPU tier — no GPU required.
All heavy inference is delegated to the Modal API.

Deploy steps:
  1. Create a Space at: https://huggingface.co/new-space
     - Owner: BasanthPR
     - Space name: piab-demo
     - SDK: Gradio
     - Hardware: CPU Basic (free)
  2. Upload this file (rename to app.py) + spaces_requirements.txt (rename to requirements.txt)
  3. Space URL: https://huggingface.co/spaces/BasanthPR/piab-demo
     App URL:   https://basanthpr-piab-demo.hf.space

IMPORTANT: Update MODAL_ASK_URL below after running `modal deploy modal_server.py`.
The URL is printed by Modal after a successful deploy.
"""

import gradio as gr
import requests
import json

# ── Modal API URL ──────────────────────────────────────────────────────────────
# Replace with the URL printed by `modal deploy modal_server.py`
# Format: https://<workspace>--piab-inference-inferenceserver-ask.modal.run
MODAL_ASK_URL = "https://basanth-periyapatnaroopakumar--piab-inference-inferences-5f6054.modal.run"

REQUEST_TIMEOUT = 180  # seconds — 60s cold start + 90s max inference

EXAMPLE_QUESTIONS = [
    "Explain binary search trees with a simple example.",
    "What is the time complexity of merge sort and why? Show the derivation.",
    "Explain the difference between BFS and DFS with use cases.",
    "What is dynamic programming? Give a classic example.",
    "Explain how a hash table works and what causes collisions.",
]


def ask_model(question: str, model: str) -> tuple[str, str]:
    """
    Send question to Modal inference API, return (answer, metadata).
    Called by Gradio on button click.
    """
    if not question.strip():
        return "Please enter a question.", ""

    try:
        response = requests.post(
            MODAL_ASK_URL,
            json={"question": question.strip(), "model": model},
            timeout=REQUEST_TIMEOUT,
            headers={"Content-Type": "application/json"},
        )
        response.raise_for_status()
        data = response.json()

        answer     = data.get("answer", "(No answer returned)")
        model_used = data.get("model_used", model)
        latency    = data.get("latency_ms", "?")

        meta = f"Model: {model_used}  |  Inference time: {latency} ms"
        return answer, meta

    except requests.exceptions.Timeout:
        return (
            "Request timed out. The model may be cold-starting (takes ~60s on first request). "
            "Please try again in a moment.",
            "Timeout"
        )
    except requests.exceptions.ConnectionError:
        return (
            "Could not reach the inference server. "
            "Check that the Modal deployment is running.",
            "Connection Error"
        )
    except Exception as e:
        return f"Error: {str(e)}", "Error"


# ── Gradio UI ──────────────────────────────────────────────────────────────────
with gr.Blocks(
    title="Professor in a Box",
    theme=gr.themes.Soft(),
    css="""
        .header-text { text-align: center; }
        .meta-box { font-size: 0.85em; color: #666; }
    """
) as demo:

    gr.Markdown(
        """
        # 🎓 Professor in a Box
        **CS AI Tutoring Agent** — DATA 298B Team 2, SJSU MSDA, Spring 2026

        Ask any Computer Science question. Choose between two fine-tuned models:
        - **Mistral-7B** — General CS concepts, explanations, and examples
        - **DeepSeek-R1-7B** — Advanced reasoning, algorithm derivations, proofs

        *First request may take ~60 seconds (cold start). Subsequent requests are fast.*
        """,
        elem_classes="header-text"
    )

    gr.Markdown("---")

    with gr.Row():
        with gr.Column(scale=3):
            question_box = gr.Textbox(
                label="Your CS Question",
                placeholder="e.g., Explain binary search trees with a simple example.",
                lines=4,
                max_lines=8,
            )

        with gr.Column(scale=1):
            model_radio = gr.Radio(
                choices=["mistral", "deepseek"],
                value="mistral",
                label="Model",
                info="Mistral = general · DeepSeek = reasoning",
            )

    with gr.Row():
        ask_btn   = gr.Button("Ask Professor", variant="primary", size="lg")
        clear_btn = gr.Button("Clear", size="lg")

    answer_box = gr.Textbox(
        label="Answer",
        lines=12,
        interactive=False,
        placeholder="Answer will appear here...",
    )

    meta_box = gr.Textbox(
        label="",
        interactive=False,
        max_lines=1,
        elem_classes="meta-box",
    )

    gr.Markdown("### Example Questions")
    gr.Examples(
        examples=[[q, "mistral"] for q in EXAMPLE_QUESTIONS[:3]]
              + [[EXAMPLE_QUESTIONS[3], "deepseek"]]
              + [[EXAMPLE_QUESTIONS[4], "deepseek"]],
        inputs=[question_box, model_radio],
        label="Click to load an example",
    )

    # ── Event handlers ─────────────────────────────────────────────────────────
    ask_btn.click(
        fn=ask_model,
        inputs=[question_box, model_radio],
        outputs=[answer_box, meta_box],
    )

    question_box.submit(
        fn=ask_model,
        inputs=[question_box, model_radio],
        outputs=[answer_box, meta_box],
    )

    clear_btn.click(
        fn=lambda: ("", "", ""),
        inputs=[],
        outputs=[question_box, answer_box, meta_box],
    )

    gr.Markdown(
        """
        ---
        *Powered by [Modal](https://modal.com) · Adapters on [HuggingFace Hub](https://huggingface.co/BasanthPR)*
        """
    )


if __name__ == "__main__":
    demo.launch()
