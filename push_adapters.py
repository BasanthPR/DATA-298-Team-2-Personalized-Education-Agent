# Cell 1 — Install dependencies
# !pip install huggingface_hub peft transformers -q

# Cell 2 — Set your HuggingFace token
# Paste your token below (the one with Write access)
HF_TOKEN = "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"  # <-- already filled in

from huggingface_hub import login, HfApi
login(token=HF_TOKEN)
api = HfApi()
user = api.whoami()
print("Logged in as:", user['name'])
print("Orgs:", [o['name'] for o in user.get('orgs', [])])

# Cell 3 — Configure repo names
# If the org 'sjsu-team2-piab' doesn't exist yet on HuggingFace,
# change ORG_NAME to your personal username (printed above as 'Logged in as:')

ORG_NAME = user["name"]

MISTRAL_REPO  = f"{ORG_NAME}/mistral7b-cs-tutor"
DEEPSEEK_REPO = f"{ORG_NAME}/deepseek-r1-7b-cs-tutor"

MISTRAL_LOCAL_DIR  = "/Users/basanthyajman/Documents/Personalized Education Agent/mistral_7b_cs_agent_results/lora_adapters"
DEEPSEEK_LOCAL_DIR = "/Users/basanthyajman/Documents/Personalized Education Agent/deepseek_final_adapter"

print("Mistral  -> will push to:", MISTRAL_REPO)
print("DeepSeek -> will push to:", DEEPSEEK_REPO)

# Cell 4 — Create repos if they don't exist, then push Mistral adapter
import os
from huggingface_hub import create_repo, upload_folder

print("Creating Mistral repo (if not exists)...")
try:
    create_repo(MISTRAL_REPO, token=HF_TOKEN, exist_ok=True, private=False)
    print("Repo ready:", MISTRAL_REPO)
except Exception as e:
    print("Repo creation note:", e)

print("\nUploading Mistral adapter files...")
upload_folder(
    folder_path=MISTRAL_LOCAL_DIR,
    repo_id=MISTRAL_REPO,
    token=HF_TOKEN,
    repo_type="model",
    commit_message="Upload Mistral-7B CS tutor LoRA adapter (DATA 298B Team 2)",
)
print("\nMistral adapter pushed successfully!")
print("View at: https://huggingface.co/" + MISTRAL_REPO)

# Cell 5 — Push DeepSeek adapter
print("Creating DeepSeek repo (if not exists)...")
try:
    create_repo(DEEPSEEK_REPO, token=HF_TOKEN, exist_ok=True, private=False)
    print("Repo ready:", DEEPSEEK_REPO)
except Exception as e:
    print("Repo creation note:", e)

print("\nUploading DeepSeek adapter files...")
upload_folder(
    folder_path=DEEPSEEK_LOCAL_DIR,
    repo_id=DEEPSEEK_REPO,
    token=HF_TOKEN,
    repo_type="model",
    commit_message="Upload DeepSeek-R1-7B CS tutor LoRA adapter (DATA 298B Team 2)",
)
print("\nDeepSeek adapter pushed successfully!")
print("View at: https://huggingface.co/" + DEEPSEEK_REPO)

# Cell 6 — Verify both repos are live
from huggingface_hub import list_repo_files

print("=" * 50)
print("VERIFICATION — Files on HuggingFace Hub")
print("=" * 50)

print(f"\nMistral ({MISTRAL_REPO}):")
for f in list_repo_files(MISTRAL_REPO, token=HF_TOKEN):
    print(" ", f)

print(f"\nDeepSeek ({DEEPSEEK_REPO}):")
for f in list_repo_files(DEEPSEEK_REPO, token=HF_TOKEN):
    print(" ", f)

print("\n=" * 50)
print("DONE. Share these repo IDs with Nischitha:")
print(" Mistral adapter: ", MISTRAL_REPO)
print(" DeepSeek adapter:", DEEPSEEK_REPO)
print("\nNischitha's server.py already has these IDs configured.")
print("She just needs to deploy server.py on EC2 — it will pull from HF automatically.")
