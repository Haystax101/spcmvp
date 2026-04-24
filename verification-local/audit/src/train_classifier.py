import os
import pandas as pd
from datasets import Dataset
from transformers import AutoTokenizer, AutoModelForSequenceClassification, Trainer, TrainingArguments
import torch

def train():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    csv_path = os.path.join(script_dir, "../../../names.csv")
    
    print(f"Loading data from {csv_path}...")
    if not os.path.exists(csv_path):
        csv_path = os.path.join(script_dir, "../../names.csv")
        if not os.path.exists(csv_path):
             raise FileNotFoundError(f"Could not find names.csv at {csv_path}")

    df = pd.read_csv(csv_path)
    
    # Map labels: person -> 1, not_person -> 0. Transformers expects the column to be named 'labels'
    label_map = {"not_person": 0, "person": 1}
    df['labels'] = df['label'].map(label_map)
    
    dataset = Dataset.from_pandas(df)
    dataset = dataset.shuffle(seed=42)
    
    # Split into train and eval
    dataset = dataset.train_test_split(test_size=0.1)
    train_dataset = dataset['train']
    eval_dataset = dataset['test']
    
    print("Initializing Transformers AutoModelForSequenceClassification...")
    model_name = "sentence-transformers/all-MiniLM-L6-v2"
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    
    def tokenize_function(examples):
        return tokenizer(examples["name"], padding="max_length", truncation=True, max_length=64)
        
    tokenized_train = train_dataset.map(tokenize_function, batched=True, remove_columns=["name", "label"])
    tokenized_eval = eval_dataset.map(tokenize_function, batched=True, remove_columns=["name", "label"])
    
    model = AutoModelForSequenceClassification.from_pretrained(model_name, num_labels=2)
    
    device = "mps" if torch.backends.mps.is_available() else "cpu"
    model.to(device)
    print(f"Using device: {device}")

    args = TrainingArguments(
        output_dir="entity_model_v3",
        num_train_epochs=3,
        per_device_train_batch_size=16,
        per_device_eval_batch_size=16,
        learning_rate=2e-5,
        eval_strategy="epoch",
        save_strategy="no",
        report_to="none"
    )

    trainer = Trainer(
        model=model,
        args=args,
        train_dataset=tokenized_train,
        eval_dataset=tokenized_eval,
    )

    print("Starting fine-tuning...")
    trainer.train()

    print("Saving model to ./entity_classifier_v3...")
    model.save_pretrained("./entity_classifier_v3")
    tokenizer.save_pretrained("./entity_classifier_v3")
    print("Done!")

if __name__ == "__main__":
    train()
