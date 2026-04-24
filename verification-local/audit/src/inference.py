import sys
import json
import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification

def main():
    # Load model and tokenizer
    model_path = "./entity_classifier_v3"
    tokenizer = AutoTokenizer.from_pretrained(model_path)
    model = AutoModelForSequenceClassification.from_pretrained(model_path)
    
    device = "mps" if torch.backends.mps.is_available() else "cpu"
    model.to(device)
    model.eval()

    # Read input from stdin
    input_data = sys.stdin.read()
    if not input_data:
        return

    names = json.loads(input_data)
    results = []

    for name in names:
        inputs = tokenizer(name, return_tensors="pt", padding=True, truncation=True, max_length=64).to(device)
        with torch.no_grad():
            logits = model(**inputs).logits
        
        predicted_class_id = logits.argmax().item()
        label = "person" if predicted_class_id == 1 else "not_person"
        results.append({"name": name, "label": label})

    print(json.dumps(results))

if __name__ == "__main__":
    main()
