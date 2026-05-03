import json

path = "push_adapters.ipynb"
with open(path, "r") as f:
    nb = json.load(f)

for cell in nb['cells']:
    if cell['cell_type'] == 'code':
        source = cell['source']
        for i, line in enumerate(source):
            if line.startswith('ORG_NAME = "sjsu-team2-piab"'):
                source[i] = 'ORG_NAME = user["name"]\n'
            elif line.startswith('MISTRAL_LOCAL_DIR  = "./mistral_adapter"'):
                source[i] = 'MISTRAL_LOCAL_DIR  = "/Users/basanthyajman/Documents/Personalized Education Agent/mistral_7b_cs_agent_results/lora_adapters"\n'
            elif line.startswith('DEEPSEEK_LOCAL_DIR = "./deepseek_adapter"'):
                source[i] = 'DEEPSEEK_LOCAL_DIR = "/Users/basanthyajman/Documents/Personalized Education Agent/deepseek_final_adapter"\n'

with open(path, "w") as f:
    json.dump(nb, f, indent=1)
