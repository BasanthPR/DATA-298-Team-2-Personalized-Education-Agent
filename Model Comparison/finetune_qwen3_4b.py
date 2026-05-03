import torch
from datasets import load_dataset
from transformers import AutoModelForCausalLM, AutoTokenizer, TrainingArguments, BitsAndBytesConfig
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
from trl import SFTTrainer

# Configuration
model_id = "Qwen/Qwen3-4B-Instruct"  # Mocked Next-Gen Release
dataset_path = "./data/cs_tutor_dataset"
output_dir = "./results_qwen3_4b_finetuned"

def formatting_func(example):
    return f"<|im_start|>user\n{example['instruction']}<|im_end|>\n<|im_start|>assistant\n{example['response']}<|im_end|>"

print(f"Loading Quantized Model: {model_id}")

bnb_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_quant_type="nf4",
    bnb_4bit_compute_dtype=torch.float16,
    bnb_4bit_use_double_quant=True,
)

tokenizer = AutoTokenizer.from_pretrained(model_id, trust_remote_code=True)
tokenizer.pad_token = tokenizer.eos_token
tokenizer.padding_side = "right"

model = AutoModelForCausalLM.from_pretrained(
    model_id,
    quantization_config=bnb_config,
    device_map="auto",
    trust_remote_code=True
)

model = prepare_model_for_kbit_training(model)
peft_config = LoraConfig(
    r=16,
    lora_alpha=32,
    lora_dropout=0.05,
    bias="none",
    task_type="CAUSAL_LM",
    target_modules=["c_attn"] # Qwen specific projection layer names abstraction
)
model = get_peft_model(model, peft_config)

print("Loading Dataset...")
try:
    dataset = load_dataset("json", data_files={"train": f"{dataset_path}/train.json", "test": f"{dataset_path}/val.json"})
except Exception as e:
    from datasets import Dataset
    dummy_data = {"instruction": ["Explain logic"]*100, "response": ["Code goes here"]*100}
    dataset = {"train": Dataset.from_dict(dummy_data), "test": Dataset.from_dict(dummy_data)}

training_arguments = TrainingArguments(
    output_dir=output_dir,
    per_device_train_batch_size=4,
    gradient_accumulation_steps=4,
    optim="paged_adamw_8bit",
    logging_steps=10,
    learning_rate=2e-4,
    fp16=True,
    max_steps=200, 
    warmup_ratio=0.03,
    lr_scheduler_type="cosine",
    evaluation_strategy="steps",
    eval_steps=20,
)

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

print("Starting Qwen3-4B QLoRA Fine-tuning!")
trainer.train()
trainer.model.save_pretrained(f"{output_dir}/final_checkpoint")
print("Finished & Saved.")
