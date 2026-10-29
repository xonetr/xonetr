import base64
import hashlib
import hmac
import json
import os
import sqlite3
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from fastapi import Cookie, FastAPI, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey, Ed25519PublicKey
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parent.parent


def project_path(value: str | Path) -> Path:
    path = Path(value)
    return path if path.is_absolute() else ROOT / path


DATABASE_PATH = project_path(os.getenv('DATABASE_PATH', 'backend/data/xonetr.sqlite3'))
MEDIA_DIRECTORY = project_path(os.getenv('MEDIA_DIRECTORY', 'backend/data/media'))
SESSION_SECRET = os.getenv('SESSION_SECRET', 'development-session-secret-change-me')
ADMIN_EMAIL = os.getenv('ADMIN_EMAIL', 'admin@xonetr.com')
ADMIN_PASSWORD = os.getenv('ADMIN_PASSWORD', 'admin123')
CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv('CORS_ORIGINS', 'http://localhost:5173,http://127.0.0.1:5173').split(',')
    if origin.strip()
]

DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)
MEDIA_DIRECTORY.mkdir(parents=True, exist_ok=True)

app = FastAPI(title='XONETR API', version='1.0.0')
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def connection() -> sqlite3.Connection:
    db = sqlite3.connect(DATABASE_PATH)
    db.row_factory = sqlite3.Row
    return db


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, 100_000)
    return f'pbkdf2_sha256${salt.hex()}${digest.hex()}'


def verify_password(password: str, hashed_password: str | None) -> bool:
    if not hashed_password or not hashed_password.startswith('pbkdf2_sha256$'):
        return False
    _, salt_hex, digest_hex = hashed_password.split('$', 2)
    salt = bytes.fromhex(salt_hex)
    expected = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, 100_000)
    return hmac.compare_digest(expected.hex(), digest_hex)


def encode_base64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode().rstrip('=')


def decode_base64(data: str) -> bytes:
    return base64.urlsafe_b64decode(data + '=' * (-len(data) % 4))


def sign(value: str) -> str:
    signature = hmac.new(SESSION_SECRET.encode(), value.encode(), hashlib.sha256).hexdigest()
    return f'{value}.{signature}'


def verify_signed(value: str) -> str | None:
    try:
        payload, signature = value.rsplit('.', 1)
    except ValueError:
        return None
    expected = hmac.new(SESSION_SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()
    return payload if hmac.compare_digest(signature, expected) else None


def serialize_user(row: sqlite3.Row | None) -> dict[str, Any] | None:
    if row is None:
        return None
    return {
        'id': row['id'],
        'name': row['name'],
        'email': row['email'],
        'role': row['role'],
        'created_at': row['created_at'],
        'active': bool(row['active']),
    }


def get_user_by_email(email: str) -> sqlite3.Row | None:
    with connection() as db:
        return db.execute(
            'SELECT * FROM users WHERE LOWER(email) = LOWER(?) AND active = 1',
            (email,),
        ).fetchone()


def get_user_by_id(user_id: str) -> sqlite3.Row | None:
    with connection() as db:
        return db.execute('SELECT * FROM users WHERE id = ? AND active = 1', (user_id,)).fetchone()


def require_session_user(session: str | None = Cookie(default=None, alias='admin_session')) -> dict[str, Any]:
    email = verify_signed(session) if session else None
    if not email:
        raise HTTPException(status_code=401, detail='No autenticado.')
    user = get_user_by_email(email)
    if user is None:
        raise HTTPException(status_code=401, detail='Usuario no válido.')
    serialized = serialize_user(user)
    if serialized is None:
        raise HTTPException(status_code=401, detail='Usuario no válido.')
    return serialized


def require_admin(session: str | None = Cookie(default=None, alias='admin_session')) -> dict[str, Any]:
    user = require_session_user(session)
    if user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail='Se requieren permisos de administrador.')
    return user


def json_content(row: sqlite3.Row | None) -> dict[str, Any] | None:
    return json.loads(row['content']) if row else None


def require_project_membership(project_id: str, user_id: str) -> None:
    with connection() as db:
        row = db.execute(
            'SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?',
            (project_id, user_id),
        ).fetchone()
    if row is None:
        raise HTTPException(status_code=403, detail='No tienes acceso a este proyecto.')


def initialize_database() -> None:
    with connection() as db:
        db.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'developer',
                created_at TEXT NOT NULL,
                active INTEGER NOT NULL DEFAULT 1
            );

            CREATE TABLE IF NOT EXISTS projects (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT NOT NULL DEFAULT '',
                status TEXT NOT NULL DEFAULT 'active',
                owner_id TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY(owner_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS project_members (
                project_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'member',
                joined_at TEXT NOT NULL,
                PRIMARY KEY(project_id, user_id),
                FOREIGN KEY(project_id) REFERENCES projects(id),
                FOREIGN KEY(user_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS tasks (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL,
                title TEXT NOT NULL,
                description TEXT NOT NULL DEFAULT '',
                status TEXT NOT NULL DEFAULT 'todo',
                priority TEXT NOT NULL DEFAULT 'medium',
                assignee_id TEXT,
                reporter_id TEXT NOT NULL,
                due_date TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY(project_id) REFERENCES projects(id),
                FOREIGN KEY(assignee_id) REFERENCES users(id),
                FOREIGN KEY(reporter_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS task_notes (
                id TEXT PRIMARY KEY,
                task_id TEXT NOT NULL,
                project_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY(task_id) REFERENCES tasks(id),
                FOREIGN KEY(project_id) REFERENCES projects(id),
                FOREIGN KEY(user_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS visit_events (
                id TEXT PRIMARY KEY,
                user_id TEXT,
                project_id TEXT,
                event_type TEXT NOT NULL DEFAULT 'page_view',
                path TEXT NOT NULL DEFAULT '/',
                session_id TEXT,
                referrer TEXT,
                user_agent TEXT,
                ip TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY(user_id) REFERENCES users(id),
                FOREIGN KEY(project_id) REFERENCES projects(id)
            );

            CREATE TABLE IF NOT EXISTS site_content (
                kind TEXT PRIMARY KEY,
                content TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS versions (
                id TEXT PRIMARY KEY,
                created_at TEXT NOT NULL,
                summary TEXT NOT NULL,
                author TEXT NOT NULL,
                content TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS media (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                size INTEGER NOT NULL,
                type TEXT NOT NULL,
                filename TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS signing_keys (
                id TEXT PRIMARY KEY,
                private_key TEXT NOT NULL,
                public_key TEXT NOT NULL,
                created_at TEXT NOT NULL,
                revoked_at TEXT
            );

            CREATE TABLE IF NOT EXISTS authorizations (
                id TEXT PRIMARY KEY,
                project TEXT NOT NULL,
                subject TEXT NOT NULL,
                scopes TEXT NOT NULL,
                payload TEXT NOT NULL,
                signature TEXT NOT NULL,
                issued_at TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                revoked_at TEXT,
                revoked_by TEXT
            );
            """
        )

        root_exists = db.execute('SELECT 1 FROM users WHERE LOWER(email) = LOWER(?)', (ADMIN_EMAIL,)).fetchone()
        if not root_exists:
            db.execute(
                'INSERT INTO users(id, name, email, password_hash, role, created_at, active) VALUES(?, ?, ?, ?, ?, ?, 1)',
                (
                    str(uuid.uuid4()),
                    'Administrador',
                    ADMIN_EMAIL,
                    hash_password(ADMIN_PASSWORD),
                    'admin',
                    utc_now(),
                ),
            )


initialize_database()


def signing_key_pair() -> tuple[str, Ed25519PrivateKey, Ed25519PublicKey]:
    with connection() as db:
        row = db.execute(
            'SELECT id, private_key FROM signing_keys WHERE revoked_at IS NULL ORDER BY created_at DESC LIMIT 1'
        ).fetchone()
        if row is None:
            private_key = Ed25519PrivateKey.generate()
            private_raw = private_key.private_bytes(
                serialization.Encoding.Raw,
                serialization.PrivateFormat.Raw,
                serialization.NoEncryption(),
            )
            public_raw = private_key.public_key().public_bytes(
                serialization.Encoding.Raw,
                serialization.PublicFormat.Raw,
            )
            key_id = str(uuid.uuid4())
            db.execute(
                'INSERT INTO signing_keys(id, private_key, public_key, created_at) VALUES(?, ?, ?, ?)',
                (
                    key_id,
                    base64.urlsafe_b64encode(private_raw).decode().rstrip('='),
                    base64.urlsafe_b64encode(public_raw).decode().rstrip('='),
                    utc_now(),
                ),
            )
            return key_id, private_key, private_key.public_key()
        private_raw = base64.urlsafe_b64decode(row['private_key'] + '=' * (-len(row['private_key']) % 4))
        private_key = Ed25519PrivateKey.from_private_bytes(private_raw)
        return row['id'], private_key, private_key.public_key()


@app.get('/api/health')
def health() -> dict[str, str]:
    return {'status': 'ok'}


class IssueAuthorization(BaseModel):
    project: str = Field(min_length=1)
    subject: str = Field(min_length=1)
    scopes: list[str] = Field(default_factory=list)
    expires_at: str = Field(min_length=1)


def authorization_token(payload: dict[str, Any], signature: str) -> str:
    raw_payload = json.dumps(payload, ensure_ascii=False, separators=(',', ':'), sort_keys=True).encode()
    return f'{encode_base64(raw_payload)}.{signature}'


@app.get('/api/authorization/public-key')
def authorization_public_key():
    key_id, _, public_key = signing_key_pair()
    public_raw = public_key.public_bytes(serialization.Encoding.Raw, serialization.PublicFormat.Raw)
    return {'keyId': key_id, 'algorithm': 'Ed25519', 'publicKey': encode_base64(public_raw)}


@app.post('/api/authorizations')
def issue_authorization(payload: IssueAuthorization, session: str | None = Cookie(default=None, alias='admin_session')):
    admin = require_admin(session)
    try:
        expires_at = datetime.fromisoformat(payload.expires_at.replace('Z', '+00:00'))
    except ValueError as error:
        raise HTTPException(status_code=422, detail='La fecha de expiración no es válida.') from error
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at <= datetime.now(timezone.utc):
        raise HTTPException(status_code=422, detail='La autorización debe vencer en el futuro.')

    authorization_id = str(uuid.uuid4())
    key_id, private_key, _ = signing_key_pair()
    claims = {
        'iss': 'xonetr',
        'kid': key_id,
        'jti': authorization_id,
        'project': payload.project,
        'sub': payload.subject,
        'scope': payload.scopes,
        'iat': utc_now(),
        'exp': expires_at.isoformat(),
    }
    payload_bytes = json.dumps(claims, ensure_ascii=False, separators=(',', ':'), sort_keys=True).encode()
    signature = encode_base64(private_key.sign(payload_bytes))
    with connection() as db:
        db.execute(
            """
            INSERT INTO authorizations
            (id, project, subject, scopes, payload, signature, issued_at, expires_at)
            VALUES(?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                authorization_id,
                payload.project,
                payload.subject,
                json.dumps(payload.scopes),
                json.dumps(claims, ensure_ascii=False),
                signature,
                claims['iat'],
                claims['exp'],
            ),
        )
    return {
        'id': authorization_id,
        'project': payload.project,
        'subject': payload.subject,
        'scopes': payload.scopes,
        'issuedAt': claims['iat'],
        'expiresAt': claims['exp'],
        'issuer': admin['email'],
        'token': authorization_token(claims, signature),
    }


@app.get('/api/authorizations')
def list_authorizations(session: str | None = Cookie(default=None, alias='admin_session')):
    require_admin(session)
    with connection() as db:
        rows = db.execute(
            """
            SELECT id, project, subject, scopes, issued_at AS issuedAt, expires_at AS expiresAt,
                   revoked_at AS revokedAt, revoked_by AS revokedBy
            FROM authorizations ORDER BY issued_at DESC
            """
        ).fetchall()
    return [{**dict(row), 'scopes': json.loads(row['scopes']), 'status': 'revoked' if row['revokedAt'] else 'active'} for row in rows]


@app.post('/api/authorizations/{authorization_id}/revoke')
def revoke_authorization(authorization_id: str, session: str | None = Cookie(default=None, alias='admin_session')):
    admin = require_admin(session)
    with connection() as db:
        row = db.execute('SELECT id FROM authorizations WHERE id = ?', (authorization_id,)).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail='La autorización no existe.')
        db.execute(
            'UPDATE authorizations SET revoked_at = ?, revoked_by = ? WHERE id = ?',
            (utc_now(), admin['email'], authorization_id),
        )
    return {'ok': True}


@app.get('/api/authorizations/{authorization_id}/verify')
def verify_authorization(authorization_id: str):
    with connection() as db:
        row = db.execute(
            'SELECT payload, signature, revoked_at, expires_at FROM authorizations WHERE id = ?',
            (authorization_id,),
        ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail='La autorización no existe.')

    claims = json.loads(row['payload'])
    key_id, _, public_key = signing_key_pair()
    try:
        public_key.verify(
            decode_base64(row['signature']),
            json.dumps(claims, ensure_ascii=False, separators=(',', ':'), sort_keys=True).encode(),
        )
    except Exception as error:
        raise HTTPException(status_code=400, detail='La firma criptográfica no es válida.') from error

    revoked = row['revoked_at'] is not None
    expires_at = datetime.fromisoformat(claims['exp'].replace('Z', '+00:00'))
    expired = expires_at <= datetime.now(timezone.utc)
    valid = not revoked and not expired and claims['kid'] == key_id
    return {
        'valid': valid,
        'status': 'revoked' if revoked else 'expired' if expired else 'active',
        'authorization': claims,
        'algorithm': 'Ed25519',
        'keyId': claims['kid'],
    }


@app.post('/api/auth/register')
def register_user(payload: dict[str, Any]):
    name = str(payload.get('name', '')).strip()
    email = str(payload.get('email', '')).strip().lower()
    password = str(payload.get('password', ''))
    role = str(payload.get('role', 'developer')).strip().lower()

    if not name or not email or len(password) < 6:
        raise HTTPException(status_code=400, detail='Nombre, email y contraseña válida son obligatorios.')
    if role not in {'admin', 'developer', 'viewer'}:
        raise HTTPException(status_code=400, detail='El rol no es válido.')
    if get_user_by_email(email) is not None:
        raise HTTPException(status_code=409, detail='Ya existe un usuario con ese email.')

    user_id = str(uuid.uuid4())
    now = utc_now()
    with connection() as db:
        db.execute(
            'INSERT INTO users(id, name, email, password_hash, role, created_at, active) VALUES(?, ?, ?, ?, ?, ?, 1)',
            (user_id, name, email, hash_password(password), role, now),
        )
    return {'id': user_id, 'name': name, 'email': email, 'role': role, 'created_at': now, 'active': True}


@app.post('/api/auth/login')
def login(payload: dict[str, Any]):
    email = str(payload.get('email', '')).strip().lower()
    password = str(payload.get('password', ''))
    user_row = get_user_by_email(email)
    if user_row is None or not verify_password(password, user_row['password_hash']):
        raise HTTPException(status_code=401, detail='El correo o la contraseña no son correctos.')

    user = serialize_user(user_row)
    result = JSONResponse({
        'id': user['id'],
        'email': user['email'],
        'name': user['name'],
        'role': user['role'],
        'signedInAt': utc_now(),
    })
    result.set_cookie(
        'admin_session',
        sign(user['email']),
        httponly=True,
        secure=os.getenv('COOKIE_SECURE', 'false').lower() == 'true',
        samesite='lax',
        max_age=60 * 60 * 8,
    )
    return result


@app.post('/api/auth/logout')
def logout():
    result = JSONResponse({'ok': True})
    result.delete_cookie('admin_session')
    return result


@app.get('/api/auth/session')
def session(session: str | None = Cookie(default=None, alias='admin_session')):
    user = require_session_user(session)
    return {'id': user['id'], 'email': user['email'], 'name': user['name'], 'role': user['role'], 'signedInAt': utc_now()}


@app.get('/api/users')
def list_users(session: str | None = Cookie(default=None, alias='admin_session')):
    require_session_user(session)
    with connection() as db:
        rows = db.execute(
            'SELECT id, name, email, role, created_at, active FROM users WHERE active = 1 ORDER BY created_at DESC'
        ).fetchall()
    return [serialize_user(row) for row in rows]


@app.post('/api/projects')
def create_project(payload: dict[str, Any], session: str | None = Cookie(default=None, alias='admin_session')):
    user = require_session_user(session)
    name = str(payload.get('name', '')).strip()
    description = str(payload.get('description', '')).strip()
    status = str(payload.get('status', 'active')).strip().lower()
    if not name:
        raise HTTPException(status_code=400, detail='El nombre del proyecto es obligatorio.')
    if status not in {'active', 'paused', 'done'}:
        raise HTTPException(status_code=400, detail='Estado de proyecto no válido.')

    project_id = str(uuid.uuid4())
    now = utc_now()
    with connection() as db:
        db.execute(
            'INSERT INTO projects(id, name, description, status, owner_id, created_at, updated_at) VALUES(?, ?, ?, ?, ?, ?, ?)',
            (project_id, name, description, status, user['id'], now, now),
        )
        db.execute(
            "INSERT INTO project_members(project_id, user_id, role, joined_at) VALUES(?, ?, 'owner', ?)",
            (project_id, user['id'], now),
        )
    return {'id': project_id, 'name': name, 'description': description, 'status': status, 'owner_id': user['id'], 'created_at': now, 'updated_at': now}


@app.get('/api/projects')
def list_projects(session: str | None = Cookie(default=None, alias='admin_session')):
    user = require_session_user(session)
    with connection() as db:
        rows = db.execute(
            """
            SELECT p.*
            FROM projects p
            INNER JOIN project_members pm ON pm.project_id = p.id
            WHERE pm.user_id = ?
            ORDER BY p.updated_at DESC
            """,
            (user['id'],),
        ).fetchall()

        result = []
        for row in rows:
            members = db.execute(
                """
                SELECT u.id, u.name, u.email, pm.role
                FROM project_members pm
                INNER JOIN users u ON u.id = pm.user_id
                WHERE pm.project_id = ?
                ORDER BY u.name
                """,
                (row['id'],),
            ).fetchall()
            result.append({
                **dict(row),
                'members': [{'id': m['id'], 'name': m['name'], 'email': m['email'], 'role': m['role']} for m in members],
            })
    return result


@app.get('/api/projects/{project_id}')
def get_project(project_id: str, session: str | None = Cookie(default=None, alias='admin_session')):
    user = require_session_user(session)
    require_project_membership(project_id, user['id'])
    with connection() as db:
        project = db.execute('SELECT * FROM projects WHERE id = ?', (project_id,)).fetchone()
        members = db.execute(
            'SELECT u.id, u.name, u.email, pm.role FROM project_members pm INNER JOIN users u ON u.id = pm.user_id WHERE pm.project_id = ? ORDER BY u.name',
            (project_id,),
        ).fetchall()
    if project is None:
        raise HTTPException(status_code=404, detail='Proyecto no encontrado.')
    return {**dict(project), 'members': [{'id': item['id'], 'name': item['name'], 'email': item['email'], 'role': item['role']} for item in members]}


@app.post('/api/projects/{project_id}/members')
def add_project_member(project_id: str, payload: dict[str, Any], session: str | None = Cookie(default=None, alias='admin_session')):
    user = require_session_user(session)
    require_project_membership(project_id, user['id'])
    email = str(payload.get('email', '')).strip().lower()
    role = str(payload.get('role', 'member')).strip().lower()
    if role not in {'owner', 'member', 'viewer'}:
        raise HTTPException(status_code=400, detail='Rol de miembro no válido.')

    member = get_user_by_email(email)
    if member is None:
        raise HTTPException(status_code=404, detail='No existe un usuario con ese email.')

    with connection() as db:
        existing = db.execute(
            'SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?',
            (project_id, member['id']),
        ).fetchone()
        if existing is None:
            db.execute(
                'INSERT INTO project_members(project_id, user_id, role, joined_at) VALUES(?, ?, ?, ?)',
                (project_id, member['id'], role, utc_now()),
            )
    return {'ok': True, 'user': {'id': member['id'], 'email': member['email'], 'name': member['name']}, 'role': role}


@app.get('/api/tasks')
def list_tasks(project_id: str | None = None, session: str | None = Cookie(default=None, alias='admin_session')):
    user = require_session_user(session)
    if project_id:
        require_project_membership(project_id, user['id'])
        where_sql = 'WHERE t.project_id = ?'
        params: list[Any] = [project_id]
    else:
        where_sql = """
            WHERE t.project_id IN (
                SELECT pm.project_id FROM project_members pm WHERE pm.user_id = ?
            )
        """
        params = [user['id']]

    with connection() as db:
        rows = db.execute(
            f"""
            SELECT t.*, p.name AS project_name,
                   u.name AS assignee_name,
                   r.name AS reporter_name
            FROM tasks t
            INNER JOIN projects p ON p.id = t.project_id
            LEFT JOIN users u ON u.id = t.assignee_id
            LEFT JOIN users r ON r.id = t.reporter_id
            {where_sql}
            ORDER BY CASE t.status
                WHEN 'backlog' THEN 0
                WHEN 'todo' THEN 1
                WHEN 'in_progress' THEN 2
                WHEN 'review' THEN 3
                WHEN 'done' THEN 4
                WHEN 'blocked' THEN 5
                ELSE 6 END,
                t.updated_at DESC
            """,
            tuple(params),
        ).fetchall()

    return [
        {
            'id': row['id'],
            'project_id': row['project_id'],
            'project_name': row['project_name'],
            'title': row['title'],
            'description': row['description'],
            'status': row['status'],
            'priority': row['priority'],
            'assignee_id': row['assignee_id'],
            'assignee_name': row['assignee_name'],
            'reporter_id': row['reporter_id'],
            'reporter_name': row['reporter_name'],
            'due_date': row['due_date'],
            'created_at': row['created_at'],
            'updated_at': row['updated_at'],
        }
        for row in rows
    ]


@app.post('/api/tasks')
def create_task(payload: dict[str, Any], session: str | None = Cookie(default=None, alias='admin_session')):
    user = require_session_user(session)
    project_id = str(payload.get('project_id', '')).strip()
    if not project_id:
        raise HTTPException(status_code=400, detail='El proyecto es obligatorio.')
    require_project_membership(project_id, user['id'])

    title = str(payload.get('title', '')).strip()
    description = str(payload.get('description', '')).strip()
    status = str(payload.get('status', 'todo')).strip().lower()
    priority = str(payload.get('priority', 'medium')).strip().lower()
    assignee_id = payload.get('assignee_id')
    due_date = payload.get('due_date')

    if status not in {'backlog', 'todo', 'in_progress', 'review', 'done', 'blocked'}:
        raise HTTPException(status_code=400, detail='Estado de tarea no válido.')
    if priority not in {'low', 'medium', 'high', 'urgent'}:
        raise HTTPException(status_code=400, detail='Prioridad de tarea no válida.')
    if not title:
        raise HTTPException(status_code=400, detail='El título es obligatorio.')
    if assignee_id is not None and get_user_by_id(str(assignee_id)) is None:
        raise HTTPException(status_code=404, detail='El usuario asignado no existe.')

    now = utc_now()
    task_id = str(uuid.uuid4())
    with connection() as db:
        db.execute(
            'INSERT INTO tasks(id, project_id, title, description, status, priority, assignee_id, reporter_id, due_date, created_at, updated_at) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            (task_id, project_id, title, description, status, priority, assignee_id, user['id'], due_date, now, now),
        )
    return {
        'id': task_id,
        'project_id': project_id,
        'title': title,
        'description': description,
        'status': status,
        'priority': priority,
        'assignee_id': assignee_id,
        'reporter_id': user['id'],
        'due_date': due_date,
        'created_at': now,
        'updated_at': now,
    }


@app.patch('/api/tasks/{task_id}')
def update_task(task_id: str, payload: dict[str, Any], session: str | None = Cookie(default=None, alias='admin_session')):
    user = require_session_user(session)
    with connection() as db:
        task = db.execute('SELECT * FROM tasks WHERE id = ?', (task_id,)).fetchone()
        if task is None:
            raise HTTPException(status_code=404, detail='Tarea no encontrada.')
        require_project_membership(task['project_id'], user['id'])

        updates: list[tuple[str, Any]] = []
        if 'title' in payload:
            updates.append(('title', str(payload['title']).strip()))
        if 'description' in payload:
            updates.append(('description', str(payload['description']).strip()))
        if 'status' in payload:
            status = str(payload['status']).strip().lower()
            if status not in {'backlog', 'todo', 'in_progress', 'review', 'done', 'blocked'}:
                raise HTTPException(status_code=400, detail='Estado de tarea no válido.')
            updates.append(('status', status))
        if 'priority' in payload:
            priority = str(payload['priority']).strip().lower()
            if priority not in {'low', 'medium', 'high', 'urgent'}:
                raise HTTPException(status_code=400, detail='Prioridad de tarea no válida.')
            updates.append(('priority', priority))
        if 'assignee_id' in payload:
            assignee_id = payload['assignee_id']
            if assignee_id is not None and get_user_by_id(str(assignee_id)) is None:
                raise HTTPException(status_code=404, detail='El usuario asignado no existe.')
            updates.append(('assignee_id', assignee_id))
        if 'due_date' in payload:
            updates.append(('due_date', payload['due_date']))

        if not updates:
            return {'ok': True}

        fields = ', '.join(f'{name} = ?' for name, _ in updates)
        values = [value for _, value in updates]
        values.extend([utc_now(), task_id])
        db.execute(f'UPDATE tasks SET {fields}, updated_at = ? WHERE id = ?', tuple(values))
    return {'ok': True}


@app.get('/api/tasks/{task_id}/notes')
def get_task_notes(task_id: str, session: str | None = Cookie(default=None, alias='admin_session')):
    user = require_session_user(session)
    with connection() as db:
        task = db.execute('SELECT project_id FROM tasks WHERE id = ?', (task_id,)).fetchone()
        if task is None:
            raise HTTPException(status_code=404, detail='Tarea no encontrada.')
        require_project_membership(task['project_id'], user['id'])
        rows = db.execute(
            """
            SELECT tn.*, u.name AS user_name
            FROM task_notes tn
            INNER JOIN users u ON u.id = tn.user_id
            WHERE tn.task_id = ?
            ORDER BY tn.created_at DESC
            """,
            (task_id,),
        ).fetchall()
    return [{
        'id': row['id'],
        'task_id': row['task_id'],
        'project_id': row['project_id'],
        'user_id': row['user_id'],
        'user_name': row['user_name'],
        'content': row['content'],
        'created_at': row['created_at'],
    } for row in rows]


@app.post('/api/tasks/{task_id}/notes')
def create_task_note(task_id: str, payload: dict[str, Any], session: str | None = Cookie(default=None, alias='admin_session')):
    user = require_session_user(session)
    with connection() as db:
        task = db.execute('SELECT project_id FROM tasks WHERE id = ?', (task_id,)).fetchone()
        if task is None:
            raise HTTPException(status_code=404, detail='Tarea no encontrada.')
        require_project_membership(task['project_id'], user['id'])
        content = str(payload.get('content', '')).strip()
        if not content:
            raise HTTPException(status_code=400, detail='La nota no puede estar vacía.')
        note_id = str(uuid.uuid4())
        created_at = utc_now()
        db.execute(
            'INSERT INTO task_notes(id, task_id, project_id, user_id, content, created_at) VALUES(?, ?, ?, ?, ?, ?)',
            (note_id, task_id, task['project_id'], user['id'], content, created_at),
        )
    return {'id': note_id, 'task_id': task_id, 'project_id': task['project_id'], 'user_id': user['id'], 'content': content, 'created_at': created_at}


@app.post('/api/analytics/visit')
def record_visit(payload: dict[str, Any]):
    event_type = str(payload.get('event_type', 'page_view')).strip().lower() or 'page_view'
    path = str(payload.get('path', '/')).strip() or '/'
    project_id = payload.get('project_id')
    session_id = payload.get('session_id')
    referrer = payload.get('referrer')
    user_agent = payload.get('user_agent')
    ip = payload.get('ip')
    user_id = payload.get('user_id')

    if project_id is not None:
        project_id = str(project_id)
    if user_id is not None:
        user_id = str(user_id)

    with connection() as db:
        db.execute(
            'INSERT INTO visit_events(id, user_id, project_id, event_type, path, session_id, referrer, user_agent, ip, created_at) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            (str(uuid.uuid4()), user_id, project_id, event_type, path, session_id, referrer, user_agent, ip, utc_now()),
        )
    return {'ok': True}


@app.get('/api/analytics/summary')
def analytics_summary(range_days: int = 7, session: str | None = Cookie(default=None, alias='admin_session')):
    require_session_user(session)
    days = max(1, min(int(range_days), 365))
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

    with connection() as db:
        total_visits = db.execute('SELECT COUNT(*) AS value FROM visit_events WHERE created_at >= ?', (since,)).fetchone()['value']
        unique_visitors = db.execute(
            'SELECT COUNT(DISTINCT session_id) AS value FROM visit_events WHERE created_at >= ? AND session_id IS NOT NULL',
            (since,),
        ).fetchone()['value']
        active_projects = db.execute("SELECT COUNT(*) AS value FROM projects WHERE status = 'active'").fetchone()['value']
        open_tasks = db.execute("SELECT COUNT(*) AS value FROM tasks WHERE status != 'done'").fetchone()['value']
        task_status = db.execute('SELECT status, COUNT(*) AS total FROM tasks GROUP BY status ORDER BY total DESC').fetchall()
        visits_by_day = db.execute(
            """
            SELECT substr(created_at, 1, 10) AS day, COUNT(*) AS total
            FROM visit_events
            WHERE created_at >= ?
            GROUP BY substr(created_at, 1, 10)
            ORDER BY day DESC
            """,
            (since,),
        ).fetchall()

    return {
        'range_days': days,
        'total_visits': total_visits,
        'unique_visitors': unique_visitors,
        'active_projects': active_projects,
        'open_tasks': open_tasks,
        'task_status': [{'status': row['status'], 'total': row['total']} for row in task_status],
        'visits_by_day': [{'day': row['day'], 'total': row['total']} for row in visits_by_day],
    }


@app.get('/api/content/published')
def published_content():
    with connection() as db:
        row = db.execute("SELECT content FROM site_content WHERE kind = 'published'").fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail='Todavía no hay contenido publicado.')
    return json.loads(row['content'])


@app.get('/api/content/draft')
def draft_content(session: str | None = Cookie(default=None, alias='admin_session')):
    require_admin(session)
    with connection() as db:
        row = db.execute("SELECT content FROM site_content WHERE kind = 'draft'").fetchone()
        if row is None:
            row = db.execute("SELECT content FROM site_content WHERE kind = 'published'").fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail='No hay borrador disponible.')
    return json.loads(row['content'])


@app.put('/api/content/draft')
def save_draft(payload: dict[str, Any], session: str | None = Cookie(default=None, alias='admin_session')):
    require_admin(session)
    with connection() as db:
        db.execute(
            """
            INSERT INTO site_content(kind, content, updated_at) VALUES('draft', ?, ?)
            ON CONFLICT(kind) DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at
            """,
            (json.dumps(payload, ensure_ascii=False), utc_now()),
        )
    return {'ok': True}


@app.delete('/api/content/draft')
def discard_draft(session: str | None = Cookie(default=None, alias='admin_session')):
    require_admin(session)
    with connection() as db:
        db.execute("DELETE FROM site_content WHERE kind = 'draft'")
    return {'ok': True}


@app.post('/api/content/publish')
def publish(session: str | None = Cookie(default=None, alias='admin_session')):
    require_admin(session)
    with connection() as db:
        draft = db.execute("SELECT content FROM site_content WHERE kind = 'draft'").fetchone()
        published = db.execute("SELECT content FROM site_content WHERE kind = 'published'").fetchone()
        if draft is None:
            raise HTTPException(status_code=404, detail='No hay borrador para publicar.')

        content = draft['content']
        db.execute(
            """
            INSERT INTO site_content(kind, content, updated_at) VALUES('published', ?, ?)
            ON CONFLICT(kind) DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at
            """,
            (content, utc_now()),
        )
        changed = json.loads(content) != json.loads(published['content']) if published else True
        db.execute(
            'INSERT INTO versions(id, created_at, summary, author, content) VALUES(?, ?, ?, ?, ?)',
            (str(uuid.uuid4()), utc_now(), 'Cambios publicados' if changed else 'Publicación sin cambios', ADMIN_EMAIL, content),
        )
        db.execute("DELETE FROM versions WHERE id NOT IN (SELECT id FROM versions ORDER BY created_at DESC LIMIT 10)")
        db.execute("DELETE FROM site_content WHERE kind = 'draft'")
    return {'ok': True}


@app.get('/api/content/versions')
def list_versions(session: str | None = Cookie(default=None, alias='admin_session')):
    require_admin(session)
    with connection() as db:
        rows = db.execute(
            'SELECT id, created_at AS createdAt, summary, author FROM versions ORDER BY created_at DESC LIMIT 10'
        ).fetchall()
    return [dict(row) for row in rows]


@app.get('/api/content/versions/{version_id}')
def get_version(version_id: str, session: str | None = Cookie(default=None, alias='admin_session')):
    require_admin(session)
    with connection() as db:
        row = db.execute('SELECT content FROM versions WHERE id = ?', (version_id,)).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail='La versión solicitada no existe.')
    return json.loads(row['content'])


@app.post('/api/content/versions/{version_id}/restore')
def restore_version(version_id: str, session: str | None = Cookie(default=None, alias='admin_session')):
    require_admin(session)
    with connection() as db:
        row = db.execute('SELECT content FROM versions WHERE id = ?', (version_id,)).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail='La versión solicitada no existe.')
        db.execute(
            """
            INSERT INTO site_content(kind, content, updated_at) VALUES('draft', ?, ?)
            ON CONFLICT(kind) DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at
            """,
            (row['content'], utc_now()),
        )
    return {'ok': True}


ALLOWED_TYPES = {'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'image/svg+xml': '.svg'}


@app.post('/api/media')
async def upload_media(file: UploadFile, session: str | None = Cookie(default=None, alias='admin_session')):
    require_admin(session)
    extension = ALLOWED_TYPES.get(file.content_type or '')
    if extension is None:
        raise HTTPException(status_code=400, detail='Usa una imagen PNG, JPG, WebP o SVG.')
    data = await file.read()
    if len(data) > 2 * 1024 * 1024:
        raise HTTPException(status_code=400, detail='La imagen no puede superar 2 MB.')

    media_id = str(uuid.uuid4())
    filename = f'{media_id}{extension}'
    (MEDIA_DIRECTORY / filename).write_bytes(data)
    created_at = utc_now()
    with connection() as db:
        db.execute(
            'INSERT INTO media(id, name, size, type, filename, created_at) VALUES(?, ?, ?, ?, ?, ?)',
            (media_id, file.filename or filename, len(data), file.content_type, filename, created_at),
        )
    return {'url': f'/api/media/{media_id}'}


@app.get('/api/media')
def list_media(session: str | None = Cookie(default=None, alias='admin_session')):
    require_admin(session)
    with connection() as db:
        rows = db.execute(
            'SELECT id, name, size, type, created_at AS createdAt FROM media ORDER BY created_at DESC'
        ).fetchall()
    return [{**dict(row), 'url': f"/api/media/{row['id']}"} for row in rows]


@app.get('/api/media/{media_id}')
def get_media(media_id: str):
    with connection() as db:
        row = db.execute('SELECT filename, type FROM media WHERE id = ?', (media_id,)).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail='Archivo no encontrado.')
    path = MEDIA_DIRECTORY / row['filename']
    if not path.exists():
        raise HTTPException(status_code=404, detail='Archivo no encontrado.')
    return FileResponse(path, media_type=row['type'])


@app.delete('/api/media/{media_id}')
def delete_media(media_id: str, session: str | None = Cookie(default=None, alias='admin_session')):
    require_admin(session)
    with connection() as db:
        row = db.execute('SELECT filename FROM media WHERE id = ?', (media_id,)).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail='Archivo no encontrado.')
        db.execute('DELETE FROM media WHERE id = ?', (media_id,))
    path = MEDIA_DIRECTORY / row['filename']
    if path.exists():
        path.unlink()
    return {'ok': True}
