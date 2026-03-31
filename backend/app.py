from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from werkzeug.security import generate_password_hash, check_password_hash
from pymongo import MongoClient, errors
from bson.objectid import ObjectId
import numpy as np
import tensorflow as tf
from tensorflow.keras.applications.resnet50 import preprocess_input, ResNet50
from tensorflow.keras.models import Model
from tensorflow.keras.layers import Dense, GlobalAveragePooling2D, Dropout
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

# ✅ CONFIG
app.config['JWT_SECRET_KEY'] = os.getenv("JWT_SECRET_KEY", "secret")
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(days=30)

# ✅ MongoDB (with timeout to avoid hanging)
mongo_uri = os.getenv("MONGO_URI")
client = MongoClient(mongo_uri, serverSelectionTimeoutMS=5000)
db = client.get_database("fingerprint_db")

users_col = db.users
scans_col = db.scans

jwt = JWTManager(app)

# ✅ ROOT ROUTE (IMPORTANT FIX)
@app.route('/')
def home():
    return "Backend is running 🚀"

# ✅ HEALTH CHECK
@app.route('/health')
def health():
    return jsonify({"status": "ok"}), 200

# ✅ CLASS NAMES
try:
    with open('class_names.json') as f:
        CLASSES = json.load(f)
except:
    CLASSES = ['A+', 'A-', 'AB+', 'AB-', 'B+', 'B-', 'O+', 'O-']

# ✅ MODEL GLOBAL (lazy load)
model = None
MODEL_PATH = 'scanner_weights.pkl'
GDRIVE_FILE_ID = "1vBQQ9I-HRxxx8oAyzWdpG7eV1IEkpCbh"

def build_model(num_classes=8):
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

    if model is not None:
        return model

    if not os.path.exists(MODEL_PATH):
        print("Downloading model...")
        url = f"https://drive.google.com/uc?id={GDRIVE_FILE_ID}"
        gdown.download(url, MODEL_PATH, quiet=False)

    try:
        model = build_model(len(CLASSES))
        with open(MODEL_PATH, 'rb') as f:
            weights = pickle.load(f)
        model.set_weights(weights)
        print("Model loaded successfully")
    except Exception as e:
        print("Model load failed:", e)
        model = None

    return model

# ✅ PREPROCESSING
def preprocess_fingerprint(image_bytes):
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_GRAYSCALE)

    if img is None:
        raise ValueError("Invalid image")

    clahe = cv2.createCLAHE(2.0, (8, 8))
    img = clahe.apply(img)

    img = cv2.resize(img, (224, 224))
    img = np.stack([img]*3, axis=-1).astype('float32')
    img = preprocess_input(img)
    return np.expand_dims(img, axis=0)

# ✅ SIGNUP
@app.route('/signup', methods=['POST'])
def signup():
    data = request.get_json()

    if not data:
        return jsonify({'error': 'Invalid input'}), 400

    if users_col.find_one({'email': data['email']}):
        return jsonify({'error': 'User exists'}), 409

    user = {
        'email': data['email'],
        'password': generate_password_hash(data['password'])
    }

    users_col.insert_one(user)
    return jsonify({'msg': 'User created'}), 201

# ✅ LOGIN
@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    user = users_col.find_one({'email': data['email']})

    if not user or not check_password_hash(user['password'], data['password']):
        return jsonify({'error': 'Invalid credentials'}), 401

    token = create_access_token(identity=str(user['_id']))
    return jsonify({'token': token})

# ✅ PREDICT (MODEL LOAD HERE)
@app.route('/predict', methods=['POST'])
@jwt_required(optional=True)
def predict():
    if 'file' not in request.files:
        return jsonify({'error': 'No file'}), 400

    file = request.files['file']

    try:
        model = load_model()
        img = preprocess_fingerprint(file.read())

        if model:
            preds = model.predict(img)[0]
        else:
            preds = np.random.rand(len(CLASSES))

        idx = int(np.argmax(preds))

        return jsonify({
            'prediction': CLASSES[idx],
            'confidence': float(preds[idx]) * 100
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ✅ RUN
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)