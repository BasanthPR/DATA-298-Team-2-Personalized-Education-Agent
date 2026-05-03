import torch
from datasets import load_dataset
from transformers import AutoModelForCausalLM, AutoTokenizer, TrainingArguments, BitsAndBytesConfig
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
from trl import SFTTrainer

# Configuration
model_id = "meta-llama/Llama-2-7b-chat-hf"
dataset_path = "./data/cs_tutor_dataset"
output_dir = "./results_llama2_7b_finetuned"

def formatting_func(example):
    return f"### User: {example['instruction']}\n### Assistant: {example['response']}"

print(f"Loading Quantized Model: {model_id}")

# 4-bit Quantization Config (QLoRA)
bnb_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_quant_type="nf4",
    bnb_4bit_compute_dtype=torch.float16,
    bnb_4bit_use_double_quant=True,
)

# Tokenizer
tokenizer = AutoTokenizer.from_pretrained(model_id, trust_remote_code=True)
tokenizer.pad_token = tokenizer.eos_token
tokenizer.padding_side = "right"

# Model Structure
model = AutoModelForCausalLM.from_pretrained(
    model_id,
    quantization_config=bnb_config,
    device_map="auto"
)

# LoRA Adapters
model = prepare_model_for_kbit_training(model)
peft_config = LoraConfig(
    r=16,
    lora_alpha=32,
    lora_dropout=0.05,
    bias="none",
    task_type="CAUSAL_LM",
    target_modules=["q_proj", "v_proj"]
)
model = get_peft_model(model, peft_config)

print("Loading Dataset...")
try:
    dataset = load_dataset("json", data_files={"train": f"{dataset_path}/train.json", "test": f"{dataset_path}/val.json"})
except Exception as e:
    print(f"Dataset not found at {dataset_path}, initiating mock dataset mapping for framework test")
    from datasets import Dataset
    dummy_data = {"instruction": ["Explain Dijkstra"]*100, "response": ["Here is the algorithm..."]*100}
    dataset = {"train": Dataset.from_dict(dummy_data), "test": Dataset.from_dict(dummy_data)}

# Training Arguments (Aligned for RTX 4090 - Batch Size 4 + Accumulation 4)
training_arguments = TrainingArguments(
    output_dir=output_dir,
    per_device_train_batch_size=4,
    gradient_accumulation_steps=4,
    optim="paged_adamw_8bit",
    logging_steps=10,
    learning_rate=2e-4,
    fp16=True,
    max_grad_norm=0.3,
    max_steps=200, 
    warmup_ratio=0.03,
    group_by_length=True,
    lr_scheduler_type="cosine",
    evaluation_strategy="steps",
    eval_steps=20,
    save_strategy="steps",
    save_steps=50,
)

# SFT Trainer Engine
trainer = SFTTrainer(
    model=model,
    train_dataset=dataset["train"],
    eval_dataset=dataset["test"],
    peft_config=peft_config,
    formatting_func=formatting_func,
    max_seq_length=512,
    tokenizer=tokenizer,
    args=training_arguments,
)

# Begin Fine-Tuning
print("Starting LLaMA-2-7B QLoRA Fine-tuning!")
trainer.train()

# Output check
trainer.model.save_pretrained(f"{output_dir}/final_checkpoint")
print("Finished & Saved.")
