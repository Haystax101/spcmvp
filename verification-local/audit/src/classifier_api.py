import json
import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification
from http.server import BaseHTTPRequestHandler, HTTPServer

# Load model globally
print("Loading model on MPS...", flush=True)
model_path = "./entity_classifier_v3"
tokenizer = AutoTokenizer.from_pretrained(model_path)
model = AutoModelForSequenceClassification.from_pretrained(model_path)

device = "mps" if torch.backends.mps.is_available() else "cpu"
model.to(device)
model.eval()
print(f"Model loaded and ready on {device}! Starting server...", flush=True)

class ClassificationHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length)
        names = json.loads(post_data.decode('utf-8'))
        
        # Process batch
        inputs = tokenizer(names, return_tensors="pt", padding=True, truncation=True, max_length=64).to(device)
        with torch.no_grad():
            logits = model(**inputs).logits
            
        predicted_class_ids = logits.argmax(dim=-1).tolist()
        
        results = []
        for name, p_class in zip(names, predicted_class_ids):
            label = "person" if p_class == 1 else "not_person"
            results.append({"name": name, "is_person": label == "person"})
            
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(results).encode('utf-8'))

    def log_message(self, format, *args):
        pass # Suppress logging to keep Node console clean

if __name__ == "__main__":
    server = HTTPServer(('127.0.0.1', 8888), ClassificationHandler)
    print("READY", flush=True)
    server.serve_forever()
