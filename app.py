import os
import json
import requests
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from PIL import Image
import pytesseract

app = Flask(__name__)
CORS(app)  # Allows frontend to call backend

API_KEY = "AIzaSyAFSmz1gJoGIxo_IV9zYmOuZi5aACPEAlI"
CX = "87709a1af316d4e7e"

UPLOAD_FOLDER = "uploads"
RESULTS_FOLDER = "results"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(RESULTS_FOLDER, exist_ok=True)

# Add route to serve index.html
@app.route('/')
def serve_frontend():
    return send_from_directory('.', 'index.html')

def extract_menu_items(image_path):
    """Extract menu items from an image using OCR"""
    image = Image.open(image_path)
    text = pytesseract.image_to_string(image)
    menu_items = [line.strip() for line in text.split("\n") if line.strip()]
    return menu_items[:5]  # Limit to first 5 items

def get_cuisine_image(cuisine_name):
    """Fetch an image URL for the given cuisine"""
    search_url = "https://www.googleapis.com/customsearch/v1"
    params = {
        "q": cuisine_name + " dish",
        "cx": CX,
        "key": API_KEY,
        "searchType": "image",
        "num": 1,
        "imgSize": "large"
    }

    response = requests.get(search_url, params=params)
    data = response.json()

    if "items" in data:
        return data["items"][0]["link"]
    return None

@app.route("/upload", methods=["POST"])
def upload_image():
    """Handles image upload and processes menu items"""
    if "image" not in request.files:
        return jsonify({"error": "No image uploaded"}), 400

    image_file = request.files["image"]
    image_path = os.path.join(UPLOAD_FOLDER, image_file.filename)
    image_file.save(image_path)

    # Extract menu items
    menu_items = extract_menu_items(image_path)

    # Get images for each menu item
    menu_data = []
    for item in menu_items:
        image_url = get_cuisine_image(item)
        menu_data.append({"name": item, "image_url": image_url})

    return jsonify({"menu_items": menu_data})

if __name__ == "__main__":
    app.run(debug=True)