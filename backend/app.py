from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from werkzeug.security import generate_password_hash, check_password_hash
from pymongo import MongoClient, errors
from bson.objectid import ObjectId
import numpy as np
from tensorflow.keras.applications.resnet50 import preprocess_input
from tensorflow.keras.applications import ResNet50
from tensorflow.keras.models import Model
from tensorflow.keras.layers import Dense, GlobalAveragePooling2D, Dropout
import cv2
import os
import json
import pickle
import gdown
from flask_pymongo import PyMongo
from datetime import timedelta, datetime
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)

# ─── Config ───────────────────────────────────────────────
app.config['MONGO_URI'] = os.getenv("MONGO_URI")
app.config['JWT_SECRET_KEY'] = os.getenv("JWT_SECRET_KEY", "change-this")
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(days=30)

mongo = PyMongo(app)
client = MongoClient(app.config['MONGO_URI'])
db = client.get_database("fingerprint_db")
users_col = db.users
scans_col = db.scans

users_col.create_index('username', unique=True)
users_col.create_index('email', unique=True)
scans_col.create_index('user_id')

jwt = JWTManager(app)

# ─── Class Names ──────────────────────────────────────────
try:
    with open('class_names.json') as f:
        CLASSES = json.load(f)
except FileNotFoundError:
    CLASSES = ['A+', 'A-', 'AB+', 'AB-', 'B+', 'B-', 'O+', 'O-']

# ─── Model Config ─────────────────────────────────────────
MODEL_PATH = 'scanner_weights.pkl'
GDRIVE_FILE_ID = "1vBQQ9I-HRxxx8oAyzWdpG7eV1IEkpCbh"

model = None  # lazy loaded

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
    if model is None:
        print("Loading model...")

        if not os.path.exists(MODEL_PATH):
            print("Downloading model...")
            url = f"https://drive.google.com/uc?id={GDRIVE_FILE_ID}"
            gdown.download(url, MODEL_PATH, quiet=False)

        model_local = build_model(num_classes=len(CLASSES))
        with open(MODEL_PATH, 'rb') as f:
            weights = pickle.load(f)

        model_local.set_weights(weights)
        model = model_local

        print("Model loaded successfully")

if not os.path.exists('static'):
    os.makedirs('static')

# ─── Preprocessing ────────────────────────────────────────
def preprocess_fingerprint(image_bytes):
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_GRAYSCALE)

    if img is None:
        raise ValueError('Could not decode image')

    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(img)
    blurred = cv2.GaussianBlur(enhanced, (3, 3), 0)

    if np.mean(blurred) < 127:
        blurred = 255 - blurred

    cv2.imwrite('static/processed.png', blurred)

    resized = cv2.resize(blurred, (224, 224))
    img_array = np.stack([resized, resized, resized], axis=-1).astype('float32')
    img_array = preprocess_input(img_array)
    img_array = np.expand_dims(img_array, axis=0)

    return img_array

# ─── Routes ───────────────────────────────────────────────
@app.route('/')
def home():
    return "Backend is running 🚀"

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'ok',
        'model_loaded': model is not None
    }), 200


@app.route('/signup', methods=['POST'])
def signup():
    data = request.get_json() or {}
    if not data.get('username') or not data.get('email') or not data.get('password'):
        return jsonify({'error': 'Missing required fields'}), 400

    username = data['username'].strip()
    email = data['email'].strip()

    if users_col.find_one({'$or': [{'username': username}, {'email': email}]}):
        return jsonify({'error': 'Username or email already exists'}), 409

    user_doc = {
        'username': username,
        'email': email,
        'password_hash': generate_password_hash(data['password']),
        'created_at': datetime.utcnow()
    }

    result = users_col.insert_one(user_doc)
    user_id = str(result.inserted_id)

    access_token = create_access_token(identity=user_id)

    return jsonify({
        'message': 'User created successfully',
        'access_token': access_token
    }), 201


@app.route('/login', methods=['POST'])
def login():
    data = request.get_json() or {}

    user = users_col.find_one({'email': data.get('email')})
    if not user or not check_password_hash(user['password_hash'], data.get('password')):
        return jsonify({'error': 'Invalid email or password'}), 401

    access_token = create_access_token(identity=str(user['_id']))

    return jsonify({
        'message': 'Login successful',
        'access_token': access_token
    }), 200


@app.route('/predict', methods=['POST'])
@jwt_required(optional=True)
def predict():
    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400

    user_id = get_jwt_identity()
    file = request.files['file']

    try:
        load_model()  # lazy load

        processed_input = preprocess_fingerprint(file.read())
        preds = model.predict(processed_input, verbose=0)[0]

        idx = int(np.argmax(preds))
        predicted_class = CLASSES[idx]
        confidence = float(preds[idx]) * 100

        scan_id = None
        if user_id:
            scan_doc = {
                'user_id': ObjectId(user_id),
                'blood_group': predicted_class,
                'confidence': confidence,
                'timestamp': datetime.utcnow()
            }
            result = scans_col.insert_one(scan_doc)
            scan_id = str(result.inserted_id)

        all_probs_dict = {CLASSES[i]: float(preds[i]) * 100 for i in range(len(CLASSES))}

        return jsonify({
            'scan_id': scan_id,
            'blood_group': predicted_class,
            'confidence': round(confidence, 2),
            'all_probabilities': all_probs_dict
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/user/scans', methods=['GET'])
@jwt_required()
def get_user_scans():
    user_id = get_jwt_identity()
    docs = scans_col.find({'user_id': ObjectId(user_id)}).sort('timestamp', -1)

    scans_data = [{
        'id': str(scan['_id']),
        'blood_group': scan['blood_group'],
        'confidence': scan['confidence'],
        'timestamp': scan['timestamp'].isoformat()
    } for scan in docs]

    return jsonify({'scans': scans_data}), 200


@app.route('/user/profile', methods=['GET'])
@jwt_required()
def get_user_profile():
    user_id = get_jwt_identity()

    user = users_col.find_one({'_id': ObjectId(user_id)})
    if not user:
        return jsonify({'error': 'User not found'}), 404

    total_scans = scans_col.count_documents({'user_id': ObjectId(user_id)})

    return jsonify({
        'user': {
            'id': str(user['_id']),
            'username': user['username'],
            'email': user['email'],
            'total_scans': total_scans
        }
    }), 200


# ✅ Optional (only for local dev)
if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)