print("App starting...")

from flask import Flask, request, jsonify, Response
from flask_cors import CORS
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from werkzeug.security import generate_password_hash, check_password_hash
from pymongo import MongoClient
from bson.objectid import ObjectId
import numpy as np
import cv2
import os
import json
import pickle
import gdown
from datetime import timedelta, datetime
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)

# ─── Config ───────────────────────────────────────────────
app.config['JWT_SECRET_KEY'] = os.getenv("JWT_SECRET_KEY", "change-this")
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(days=30)

jwt = JWTManager(app)

# ─── Lazy MongoDB (WITH TIMEOUT FIX) ──────────────────────
def get_db():
    uri = os.getenv("MONGO_URI")
    if not uri:
        raise Exception("MONGO_URI not set")

    client = MongoClient(uri, serverSelectionTimeoutMS=3000)  # 🔥 FIX
    db = client.get_database("fingerprint_db")
    return db

# ─── Class Names ──────────────────────────────────────────
try:
    with open('class_names.json') as f:
        CLASSES = json.load(f)
except:
    CLASSES = ['A+', 'A-', 'AB+', 'AB-', 'B+', 'B-', 'O+', 'O-']

# ─── Model Config ─────────────────────────────────────────
MODEL_PATH = 'scanner_weights.pkl'
GDRIVE_FILE_ID = "1vBQQ9I-HRxxx8oAyzWdpG7eV1IEkpCbh"

model = None

def build_model(num_classes=8):
    from tensorflow.keras.applications import ResNet50
    from tensorflow.keras.models import Model
    from tensorflow.keras.layers import Dense, GlobalAveragePooling2D, Dropout

    base_model = ResNet50(weights=None, include_top=False, input_shape=(224, 224, 3))
    x = base_model.output
    x = GlobalAveragePooling2D()(x)
    x = Dropout(0.3)(x)
    x = Dense(256, activation='relu')(x)
    x = Dropout(0.3)(x)
    output = Dense(num_classes, activation='softmax')(x)
    return Model(inputs=base_model.input, outputs=output)

def load_model():
    global model
    if model is None:
        print("Loading model...")

        if not os.path.exists(MODEL_PATH):
            print("Downloading model...")
            url = f"https://drive.google.com/uc?id={GDRIVE_FILE_ID}"
            gdown.download(url, MODEL_PATH, quiet=False)

        model_local = build_model(len(CLASSES))
        with open(MODEL_PATH, 'rb') as f:
            weights = pickle.load(f)

        model_local.set_weights(weights)
        model = model_local

        print("Model loaded successfully")

# ─── Preprocessing ────────────────────────────────────────
def preprocess_fingerprint(image_bytes):
    from tensorflow.keras.applications.resnet50 import preprocess_input

    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_GRAYSCALE)

    if img is None:
        raise ValueError("Invalid image")

    resized = cv2.resize(img, (224, 224))
    img_array = np.stack([resized]*3, axis=-1).astype('float32')
    img_array = preprocess_input(img_array)
    img_array = np.expand_dims(img_array, axis=0)

    return img_array

# ─── CRITICAL ROUTES (Railway Health Fix) ─────────────────
@app.route('/')
def home():
    return Response("OK", status=200, mimetype='text/plain')  # 🔥 FIX

@app.route('/ping')
def ping():
    return "pong", 200  # 🔥 ADD

@app.route('/health')
def health():
    return {"status": "ok"}, 200

# ─── AUTH ROUTES ──────────────────────────────────────────
@app.route('/signup', methods=['POST'])
def signup():
    db = get_db()
    users = db.users

    data = request.get_json() or {}

    if users.find_one({'email': data.get('email')}):
        return jsonify({'error': 'User exists'}), 409

    user = {
        'username': data.get('username'),
        'email': data.get('email'),
        'password_hash': generate_password_hash(data.get('password')),
        'created_at': datetime.utcnow()
    }

    result = users.insert_one(user)
    token = create_access_token(identity=str(result.inserted_id))

    return jsonify({'access_token': token}), 201

@app.route('/login', methods=['POST'])
def login():
    db = get_db()
    users = db.users

    data = request.get_json() or {}
    user = users.find_one({'email': data.get('email')})

    if not user or not check_password_hash(user['password_hash'], data.get('password')):
        return jsonify({'error': 'Invalid credentials'}), 401

    token = create_access_token(identity=str(user['_id']))
    return jsonify({'access_token': token}), 200

# ─── ML ROUTE ─────────────────────────────────────────────
@app.route('/predict', methods=['POST'])
def predict():
    db = get_db()
    scans = db.scans

    if 'file' not in request.files:
        return jsonify({'error': 'No file'}), 400

    try:
        load_model()

        processed = preprocess_fingerprint(request.files['file'].read())
        preds = model.predict(processed, verbose=0)[0]

        idx = int(np.argmax(preds))

        return jsonify({
            "prediction": CLASSES[idx],
            "confidence": float(preds[idx]) * 100
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ─── LOCAL RUN ────────────────────────────────────────────
if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)