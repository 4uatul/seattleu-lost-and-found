import os
import requests
from datetime import datetime, timezone

def utcnow():
    return datetime.now(timezone.utc)
from functools import wraps

from flask import Flask, request, jsonify, g
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import text
import boto3
from jose import jwt, JWTError

app = Flask(__name__)
CORS(app)

# ============================================================
# CONFIGURATION
# ============================================================

COGNITO_REGION = os.environ.get('COGNITO_REGION', 'us-west-2')
COGNITO_USER_POOL_ID = os.environ.get('COGNITO_USER_POOL_ID', 'us-west-2_BN3BqKpKY')
COGNITO_APP_CLIENT_ID = os.environ.get('COGNITO_APP_CLIENT_ID', '4s12pis7k2c35m6gemfdrpi4v5')
COGNITO_ISSUER = f'https://cognito-idp.{COGNITO_REGION}.amazonaws.com/{COGNITO_USER_POOL_ID}'
COGNITO_JWKS_URL = f'{COGNITO_ISSUER}/.well-known/jwks.json'

DB_HOST = os.environ.get('DB_HOST', 'seattleu-lf-db.ctwcasg48t3y.us-west-2.rds.amazonaws.com')
DB_PORT = os.environ.get('DB_PORT', '5432')
DB_NAME = os.environ.get('DB_NAME', 'lostfound')
DB_USER = os.environ.get('DB_USER', 'lostfoundadmin')
DB_PASSWORD = os.environ.get('DB_PASSWORD', '')

S3_BUCKET = os.environ.get('S3_BUCKET', 'seattleu-lf-images-534212415559')
S3_REGION = os.environ.get('S3_REGION', 'us-west-2')

app.config['SQLALCHEMY_DATABASE_URI'] = (
    f'postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}'
)
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

# ============================================================
# MODELS
# ============================================================

class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    cognito_sub = db.Column(db.String(255), unique=True, nullable=False)
    email = db.Column(db.String(255), unique=True, nullable=False)
    full_name = db.Column(db.String(255))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    reported_items = db.relationship('Item', foreign_keys='Item.reporter_id', backref='reporter')
    claimed_items = db.relationship('Item', foreign_keys='Item.claimer_id', backref='claimer')

    def to_dict(self):
        return {
            'id': self.id,
            'email': self.email,
            'full_name': self.full_name,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class Item(db.Model):
    __tablename__ = 'items'

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text)
    category = db.Column(db.String(50), nullable=False)
    status = db.Column(db.String(20), default='open')
    item_type = db.Column(db.String(10), nullable=False)
    location = db.Column(db.String(255))
    date_occurred = db.Column(db.Date, nullable=False)
    image_url = db.Column(db.String(500))
    reporter_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    claimer_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'description': self.description,
            'category': self.category,
            'status': self.status,
            'item_type': self.item_type,
            'location': self.location,
            'date_occurred': self.date_occurred.isoformat() if self.date_occurred else None,
            'image_url': self.image_url,
            'reporter_id': self.reporter_id,
            'reporter_name': self.reporter.full_name if self.reporter else None,
            'reporter_email': self.reporter.email if self.reporter else None,
            'claimer_id': self.claimer_id,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }

# ============================================================
# COGNITO JWT VALIDATION
# ============================================================

_jwks_cache = None

def get_jwks():
    global _jwks_cache
    if _jwks_cache is None:
        response = requests.get(COGNITO_JWKS_URL)
        response.raise_for_status()
        _jwks_cache = response.json()['keys']
    return _jwks_cache

def verify_token(token):
    headers = jwt.get_unverified_headers(token)
    kid = headers['kid']

    jwks = get_jwks()
    key = next((k for k in jwks if k['kid'] == kid), None)
    if key is None:
        raise JWTError('Public key not found')

    payload = jwt.decode(
        token,
        key,
        algorithms=['RS256'],
        audience=COGNITO_APP_CLIENT_ID,
        issuer=COGNITO_ISSUER,
    )
    return payload

def auth_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            return jsonify({'error': 'Missing or invalid Authorization header'}), 401
        token = auth_header.split(' ', 1)[1]
        try:
            g.user = verify_token(token)
        except Exception as e:
            return jsonify({'error': f'Invalid token: {str(e)}'}), 401
        return f(*args, **kwargs)
    return decorated

# ============================================================
# HELPERS
# ============================================================

def get_or_create_user():
    """Return the DB user row for the authenticated Cognito user, creating it if needed."""
    sub = g.user['sub']
    email = g.user.get('email', '')
    name = g.user.get('name', '')

    user = User.query.filter_by(cognito_sub=sub).first()
    if user is None:
        user = User(cognito_sub=sub, email=email, full_name=name)
        db.session.add(user)
        db.session.commit()
    return user

# ============================================================
# ROUTES
# ============================================================

@app.route('/api/health')
def health():
    try:
        db.session.execute(text('SELECT 1'))
        db_status = 'connected'
    except Exception:
        db_status = 'disconnected'
    return jsonify({'status': 'healthy', 'db': db_status})


@app.route('/api/me')
@auth_required
def get_me():
    user = get_or_create_user()
    return jsonify(user.to_dict())


@app.route('/api/items', methods=['GET'])
@auth_required
def get_items():
    item_type = request.args.get('item_type')
    category = request.args.get('category')
    status = request.args.get('status', 'open')

    query = Item.query

    if item_type:
        query = query.filter_by(item_type=item_type)
    if category:
        query = query.filter_by(category=category)
    if status:
        query = query.filter_by(status=status)

    items = query.order_by(Item.created_at.desc()).all()
    return jsonify([i.to_dict() for i in items])


@app.route('/api/items', methods=['POST'])
@auth_required
def create_item():
    data = request.get_json()
    if not data:
        return jsonify({'error': 'Request body must be JSON'}), 400

    required = ['title', 'category', 'item_type', 'date_occurred']
    missing = [f for f in required if f not in data]
    if missing:
        return jsonify({'error': f'Missing required fields: {", ".join(missing)}'}), 400

    if data['item_type'] not in ('lost', 'found'):
        return jsonify({'error': 'item_type must be "lost" or "found"'}), 400

    user = get_or_create_user()

    item = Item(
        title=data['title'],
        description=data.get('description'),
        category=data['category'],
        item_type=data['item_type'],
        location=data.get('location'),
        date_occurred=data['date_occurred'],
        image_url=data.get('image_url'),
        reporter_id=user.id,
    )
    db.session.add(item)
    db.session.commit()

    return jsonify(item.to_dict()), 201


@app.route('/api/items/<int:item_id>', methods=['GET'])
@auth_required
def get_item(item_id):
    item = Item.query.get(item_id)
    if item is None:
        return jsonify({'error': 'Item not found'}), 404
    return jsonify(item.to_dict())


@app.route('/api/items/<int:item_id>/claim', methods=['PUT'])
@auth_required
def claim_item(item_id):
    item = Item.query.get(item_id)
    if item is None:
        return jsonify({'error': 'Item not found'}), 404
    if item.status != 'open':
        return jsonify({'error': 'Item is not available for claiming'}), 400

    user = get_or_create_user()
    if item.reporter_id == user.id:
        return jsonify({'error': 'You cannot claim your own item'}), 400

    item.claimer_id = user.id
    item.status = 'claimed'
    item.updated_at = utcnow()
    db.session.commit()

    return jsonify(item.to_dict())


@app.route('/api/upload-url')
@auth_required
def get_upload_url():
    filename = request.args.get('filename')
    if not filename:
        return jsonify({'error': 'filename query parameter is required'}), 400

    timestamp = utcnow().strftime('%Y%m%d_%H%M%S')
    key = f'items/{timestamp}_{filename}'

    s3 = boto3.client('s3', region_name=S3_REGION)
    upload_url = s3.generate_presigned_url(
        'put_object',
        Params={
            'Bucket': S3_BUCKET,
            'Key': key,
            'ContentType': 'image/jpeg',
        },
        ExpiresIn=300,
    )

    image_url = f'https://{S3_BUCKET}.s3.{S3_REGION}.amazonaws.com/{key}'
    return jsonify({'upload_url': upload_url, 'image_url': image_url})


# ============================================================
# RUN
# ============================================================

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
