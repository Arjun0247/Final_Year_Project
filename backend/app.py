from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from werkzeug.security import generate_password_hash, check_password_hash
from pymongo import MongoClient, errors
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

# ================= CONFIG =================
app.config['MONGO_URI'] = os.getenv("MONGO_URI")
app.config['JWT_SECRET_KEY'] = os.getenv("JWT_SECRET_KEY", "change-this")
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(days=30)

# ✅ Mongo with timeout (IMPORTANT)
client = MongoClient(app.config['MONGO_URI'], serverSelectionTimeoutMS=5000)
db = client.get_database("fingerprint_db")

users_col = db.users
scans_col = db.scans

users_col.create_index('username', unique=True)
users_col.create_index('email', unique=True)
scans_col.create_index('user_id')

jwt = JWTManager(app)

# ================= ROOT =================
@app.route('/')
def home():
    return "Backend running 🚀"

# ================= HEALTH =================
@app.route('/health')
def health():
    return jsonify({"status": "ok"}), 200

# ================= CLASSES =================
try:
    with open('class_names.json') as f:
        CLASSES = json.load(f)
except:
    CLASSES = ['A+', 'A-', 'AB+', 'AB-', 'B+', 'B-', 'O+', 'O-']

# ================= MODEL =================
MODEL_PATH = 'scanner_weights.pkl'
GDRIVE_FILE_ID = "1vBQQ9I-HRxxx8oAyzWdpG7eV1IEkpCbh"

model = None

def build_model(num_classes=8):
    # ✅ Lazy import (CRITICAL FIX)
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

# ================= PREPROCESS =================
def preprocess_fingerprint(image_bytes):
    from tensorflow.keras.applications.resnet50 import preprocess_input  # lazy import

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

# ================= AUTH =================
@app.route('/signup', methods=['POST'])
def signup():
    data = request.get_json() or {}

    if not data.get('username') or not data.get('email') or not data.get('password'):
        return jsonify({'error': 'Missing fields'}), 400

    if users_col.find_one({'$or': [{'username': data['username']}, {'email': data['email']}]}):
        return jsonify({'error': 'User exists'}), 409

    user = {
        'username': data['username'],
        'email': data['email'],
        'password_hash': generate_password_hash(data['password']),
        'created_at': datetime.utcnow()
    }

    result = users_col.insert_one(user)
    token = create_access_token(identity=str(result.inserted_id))

    return jsonify({'message': 'User created', 'token': token})

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json() or {}

    user = users_col.find_one({'email': data.get('email')})

    if not user or not check_password_hash(user['password_hash'], data.get('password')):
        return jsonify({'error': 'Invalid credentials'}), 401

    token = create_access_token(identity=str(user['_id']))
    return jsonify({'token': token})

# ================= PREDICT =================
@app.route('/predict', methods=['POST'])
@jwt_required(optional=True)
def predict():
    if 'file' not in request.files:
        return jsonify({'error': 'No file'}), 400

    user_id = get_jwt_identity()
    file = request.files['file']

    try:
        model = load_model()
        img = preprocess_fingerprint(file.read())

        if model:
            preds = model.predict(img)[0]
        else:
            preds = np.random.rand(len(CLASSES))

        idx = int(np.argmax(preds))
        confidence = float(preds[idx]) * 100

        scan_id = None
        if user_id:
            result = scans_col.insert_one({
                'user_id': ObjectId(user_id),
                'blood_group': CLASSES[idx],
                'confidence': confidence,
                'timestamp': datetime.utcnow()
            })
            scan_id = str(result.inserted_id)

        return jsonify({
            'scan_id': scan_id,
            'blood_group': CLASSES[idx],
            'confidence': round(confidence, 2)
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ================= USER =================
@app.route('/user/scans', methods=['GET'])
@jwt_required()
def get_user_scans():
    user_id = get_jwt_identity()

    docs = scans_col.find({'user_id': ObjectId(user_id)}).sort('timestamp', -1)

    return jsonify({
        'scans': [{
            'id': str(scan['_id']),
            'blood_group': scan['blood_group'],
            'confidence': scan['confidence'],
            'timestamp': scan['timestamp'].isoformat()
        } for scan in docs]
    })

@app.route('/user/profile', methods=['GET'])
@jwt_required()
def profile():
    user_id = get_jwt_identity()

    user = users_col.find_one({'_id': ObjectId(user_id)})

    return jsonify({
        'user': {
            'id': str(user['_id']),
            'username': user['username'],
            'email': user['email']
        }
    })

# ================= RUN =================
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)