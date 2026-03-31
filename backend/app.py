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

# ─── Lazy MongoDB (FIXED) ─────────────────────────────────
def get_db():
    uri = os.getenv("MONGO_URI")
    if not uri:
        raise Exception("MONGO_URI not set")

    return MongoClient(uri, serverSelectionTimeoutMS=3000).get_database("fingerprint_db")

# ─── Class Names ──────────────────────────────────────────
try:
    with open('class_names.json') as f:
        CLASSES = json.load(f)
except:
    CLASSES = ['A+', 'A-', 'AB+', 'AB-', 'B+', 'B-', 'O+', 'O-']

# ─── Model (LAZY LOADED) ──────────────────────────────────
MODEL_PATH = 'scanner_weights.pkl'
GDRIVE_FILE_ID = "1vBQQ9I-HRxxx8oAyzWdpG7eV1IEkpCbh"

model = None

def build_model():
    from tensorflow.keras.applications import ResNet50
    from tensorflow.keras.models import Model
    from tensorflow.keras.layers import Dense, GlobalAveragePooling2D, Dropout

    base = ResNet50(weights=None, include_top=False, input_shape=(224,224,3))
    x = GlobalAveragePooling2D()(base.output)
    x = Dropout(0.3)(x)
    x = Dense(256, activation='relu')(x)
    x = Dropout(0.3)(x)
    out = Dense(len(CLASSES), activation='softmax')(x)
    return Model(inputs=base.input, outputs=out)

def load_model():
    global model
    if model is None:
        print("Loading model...")

        if not os.path.exists(MODEL_PATH):
            print("Downloading model...")
            gdown.download(f"https://drive.google.com/uc?id={GDRIVE_FILE_ID}", MODEL_PATH, quiet=False)

        model_local = build_model()
        with open(MODEL_PATH, "rb") as f:
            weights = pickle.load(f)

        model_local.set_weights(weights)
        model = model_local

# ─── Preprocessing ────────────────────────────────────────
def preprocess(image_bytes):
    from tensorflow.keras.applications.resnet50 import preprocess_input

    img = cv2.imdecode(np.frombuffer(image_bytes, np.uint8), cv2.IMREAD_GRAYSCALE)
    img = cv2.resize(img, (224,224))
    img = np.stack([img]*3, axis=-1).astype("float32")
    img = preprocess_input(img)
    return np.expand_dims(img, axis=0)

# ─── CRITICAL ROUTES ──────────────────────────────────────
@app.route('/')
def home():
    return Response("OK", 200)

@app.route('/ping')
def ping():
    return "pong"

@app.route('/health')
def health():
    return {"status":"ok"}

# ─── AUTH ─────────────────────────────────────────────────
@app.route('/signup', methods=['POST'])
def signup():
    db = get_db()
    users = db.users

    data = request.get_json()
    if users.find_one({'email': data.get('email')}):
        return jsonify({'error': 'User exists'}), 409

    user = {
        "username": data.get("username"),
        "email": data.get("email"),
        "password_hash": generate_password_hash(data.get("password")),
        "created_at": datetime.utcnow()
    }

    uid = users.insert_one(user).inserted_id
    return jsonify({"token": create_access_token(identity=str(uid))})

@app.route('/login', methods=['POST'])
def login():
    db = get_db()
    users = db.users

    data = request.get_json()
    user = users.find_one({'email': data.get('email')})

    if not user or not check_password_hash(user['password_hash'], data.get('password')):
        return jsonify({'error':'Invalid'}), 401

    return jsonify({"token": create_access_token(identity=str(user['_id']))})

# ─── PREDICT ──────────────────────────────────────────────
@app.route('/predict', methods=['POST'])
def predict():
    load_model()
    file = request.files['file']
    preds = model.predict(preprocess(file.read()))[0]
    return jsonify({"prediction": CLASSES[int(np.argmax(preds))]})

# ─── LOCAL RUN ────────────────────────────────────────────
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)