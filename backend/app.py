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

from fastapi import Cookie, FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from cryptography.exceptions import InvalidSignature
from cryptography.fernet import Fernet, InvalidToken
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


def secret_from_env(name: str) -> str | None:
    """Lee NAME o, si existe, el archivo indicado en NAME_FILE (secretos de Docker)."""
    file_path = os.getenv(f'{name}_FILE')
    if file_path:
        return Path(file_path).read_text(encoding='utf-8').strip()
    return os.getenv(name)


# Clave con la que se cifran en reposo las claves privadas Ed25519. Debe vivir fuera de la base de datos
# (variable de entorno o secreto de Docker): una copia de la base no alcanza para firmar autorizaciones.
SIGNING_KEY_SECRET = secret_from_env('SIGNING_KEY_SECRET') or SESSION_SECRET
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


ENCRYPTED_KEY_PREFIX = 'fernet:'


def key_encryption() -> Fernet:
    digest = hashlib.sha256(b'xonetr-signing-key|' + SIGNING_KEY_SECRET.encode()).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def seal_private_key(private_raw: bytes) -> str:
    return ENCRYPTED_KEY_PREFIX + key_encryption().encrypt(private_raw).decode()


def unseal_private_key(stored: str) -> bytes:
    if not stored.startswith(ENCRYPTED_KEY_PREFIX):
        # Formato anterior (sin cifrar); protect_stored_signing_keys lo migra al arrancar.
        return decode_base64(stored)
    try:
        return key_encryption().decrypt(stored[len(ENCRYPTED_KEY_PREFIX):].encode())
    except InvalidToken as error:
        raise RuntimeError(
            'No se pudo descifrar la clave de firma: SIGNING_KEY_SECRET no coincide con el usado al crearla.'
        ) from error


def protect_stored_signing_keys(db: sqlite3.Connection) -> None:
    """Cifra las claves privadas que quedaron guardadas en texto plano por versiones anteriores."""
    rows = db.execute(
        'SELECT id, private_key FROM signing_keys WHERE private_key NOT LIKE ?', (ENCRYPTED_KEY_PREFIX + '%',)
    ).fetchall()
    for row in rows:
        db.execute(
            'UPDATE signing_keys SET private_key = ? WHERE id = ?',
            (seal_private_key(decode_base64(row['private_key'])), row['id']),
        )


def canonical_json(value: dict[str, Any]) -> bytes:
    return json.dumps(value, ensure_ascii=False, separators=(',', ':'), sort_keys=True).encode()


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
        'is_root': bool(row['is_root']) if 'is_root' in row.keys() else False,
    }


def user_is_root(row: sqlite3.Row | None) -> bool:
    return bool(row['is_root']) if row is not None and 'is_root' in row.keys() else False


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
                active INTEGER NOT NULL DEFAULT 1,
                is_root INTEGER NOT NULL DEFAULT 0
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
                changed_sections TEXT NOT NULL DEFAULT '[]',
                author_name TEXT,
                author_email TEXT,
                content TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS media (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                size INTEGER NOT NULL,
                type TEXT NOT NULL,
                filename TEXT NOT NULL,
                original_filename TEXT,
                original_size INTEGER,
                original_type TEXT,
                edit TEXT,
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

            -- Credenciales con las que el backend de cada cliente consulta renovaciones y revocaciones.
            -- Solo se guarda el hash del secreto; el secreto se muestra una única vez al crearlo o rotarlo.
            CREATE TABLE IF NOT EXISTS license_clients (
                id TEXT PRIMARY KEY,
                project TEXT NOT NULL,
                subject TEXT NOT NULL,
                name TEXT NOT NULL DEFAULT '',
                secret_hash TEXT NOT NULL,
                created_at TEXT NOT NULL,
                created_by TEXT,
                last_seen_at TEXT,
                revoked_at TEXT
            );
            """
        )

        authorization_columns = [column[1] for column in db.execute('PRAGMA table_info(authorizations)').fetchall()]
        if 'renewed_from' not in authorization_columns:
            db.execute('ALTER TABLE authorizations ADD COLUMN renewed_from TEXT')
        if 'revoke_reason' not in authorization_columns:
            db.execute('ALTER TABLE authorizations ADD COLUMN revoke_reason TEXT')

        protect_stored_signing_keys(db)

        columns = [column[1] for column in db.execute('PRAGMA table_info(users)').fetchall()]
        if 'is_root' not in columns:
            db.execute('ALTER TABLE users ADD COLUMN is_root INTEGER NOT NULL DEFAULT 0')

        version_columns = [column[1] for column in db.execute('PRAGMA table_info(versions)').fetchall()]
        if 'changed_sections' not in version_columns:
            db.execute("ALTER TABLE versions ADD COLUMN changed_sections TEXT NOT NULL DEFAULT '[]'")
        if 'author_name' not in version_columns:
            db.execute('ALTER TABLE versions ADD COLUMN author_name TEXT')
        if 'author_email' not in version_columns:
            db.execute('ALTER TABLE versions ADD COLUMN author_email TEXT')

        media_columns = [column[1] for column in db.execute('PRAGMA table_info(media)').fetchall()]
        if 'original_filename' not in media_columns:
            db.execute('ALTER TABLE media ADD COLUMN original_filename TEXT')
        if 'original_size' not in media_columns:
            db.execute('ALTER TABLE media ADD COLUMN original_size INTEGER')
        if 'original_type' not in media_columns:
            db.execute('ALTER TABLE media ADD COLUMN original_type TEXT')
        if 'edit' not in media_columns:
            db.execute('ALTER TABLE media ADD COLUMN edit TEXT')

        root_user = db.execute('SELECT * FROM users WHERE LOWER(email) = LOWER(?)', (ADMIN_EMAIL,)).fetchone()
        if root_user is None:
            db.execute(
                'INSERT INTO users(id, name, email, password_hash, role, created_at, active, is_root) VALUES(?, ?, ?, ?, ?, ?, 1, 1)',
                (
                    str(uuid.uuid4()),
                    'Administrador',
                    ADMIN_EMAIL,
                    hash_password(ADMIN_PASSWORD),
                    'admin',
                    utc_now(),
                ),
            )
        else:
            db.execute(
                'UPDATE users SET role = ?, is_root = 1 WHERE id = ?',
                ('admin', root_user['id']),
            )


initialize_database()


# ---------------------------------------------------------------- autorizaciones (licencias) firmadas con Ed25519
#
# Formato del token: base64url(JSON canónico de los claims) + "." + base64url(firma Ed25519 de esos bytes).
# Claims: iss="xonetr", kid (clave que firmó), jti (id de la autorización), project (p. ej. "escfutboll"),
# sub (ID del cliente), scope (módulos permitidos), iat y exp (ISO 8601 UTC), y renews (jti renovado, opcional).
#
# Rotación: siempre se firma con la clave más reciente no revocada. Las anteriores siguen publicadas y
# verificando las autorizaciones vigentes que firmaron; solo revocar una clave invalida lo que firmó.

def generate_signing_key(db: sqlite3.Connection) -> tuple[str, Ed25519PrivateKey]:
    private_key = Ed25519PrivateKey.generate()
    private_raw = private_key.private_bytes(
        serialization.Encoding.Raw,
        serialization.PrivateFormat.Raw,
        serialization.NoEncryption(),
    )
    public_raw = private_key.public_key().public_bytes(serialization.Encoding.Raw, serialization.PublicFormat.Raw)
    key_id = str(uuid.uuid4())
    db.execute(
        'INSERT INTO signing_keys(id, private_key, public_key, created_at) VALUES(?, ?, ?, ?)',
        (key_id, seal_private_key(private_raw), encode_base64(public_raw), utc_now()),
    )
    return key_id, private_key


def signing_key_pair() -> tuple[str, Ed25519PrivateKey, Ed25519PublicKey]:
    """Clave activa para firmar (la más reciente no revocada); se crea si no hay ninguna."""
    with connection() as db:
        row = db.execute(
            'SELECT id, private_key FROM signing_keys WHERE revoked_at IS NULL ORDER BY created_at DESC LIMIT 1'
        ).fetchone()
        if row is None:
            key_id, private_key = generate_signing_key(db)
            return key_id, private_key, private_key.public_key()
    private_key = Ed25519PrivateKey.from_private_bytes(unseal_private_key(row['private_key']))
    return row['id'], private_key, private_key.public_key()


def verification_key(key_id: str) -> Ed25519PublicKey | None:
    """Clave pública de `key_id` si existe y no fue revocada (sirve para claves ya rotadas)."""
    with connection() as db:
        row = db.execute(
            'SELECT public_key FROM signing_keys WHERE id = ? AND revoked_at IS NULL', (key_id,)
        ).fetchone()
    return Ed25519PublicKey.from_public_bytes(decode_base64(row['public_key'])) if row else None


def published_keys() -> list[dict[str, Any]]:
    signing_key_pair()  # garantiza que exista al menos una clave
    with connection() as db:
        rows = db.execute(
            'SELECT id, public_key, created_at, revoked_at FROM signing_keys ORDER BY created_at DESC'
        ).fetchall()
    active_id = next((row['id'] for row in rows if row['revoked_at'] is None), None)
    return [
        {
            'keyId': row['id'],
            'algorithm': 'Ed25519',
            'publicKey': row['public_key'],
            'createdAt': row['created_at'],
            'status': 'revoked' if row['revoked_at'] else 'active' if row['id'] == active_id else 'retired',
            'revokedAt': row['revoked_at'],
        }
        for row in rows
    ]


def parse_utc(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.replace('Z', '+00:00'))
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


@app.get('/api/health')
def health() -> dict[str, str]:
    return {'status': 'ok'}


class IssueAuthorization(BaseModel):
    project: str = Field(min_length=1, max_length=80)
    subject: str = Field(min_length=1, max_length=120)
    scopes: list[str] = Field(default_factory=list)
    expires_at: str = Field(min_length=1)


class RenewAuthorization(BaseModel):
    expires_at: str = Field(min_length=1)
    scopes: list[str] | None = None
    revoke_previous: bool = False


class RevokeAuthorization(BaseModel):
    reason: str = Field(default='', max_length=500)


class CreateLicenseClient(BaseModel):
    project: str = Field(min_length=1, max_length=80)
    subject: str = Field(min_length=1, max_length=120)
    name: str = Field(default='', max_length=200)


class LicenseCheck(BaseModel):
    project: str = Field(min_length=1, max_length=80)
    jti: str | None = None


def authorization_token(payload: dict[str, Any], signature: str) -> str:
    return f'{encode_base64(canonical_json(payload))}.{signature}'


def parse_future_expiry(value: str) -> datetime:
    try:
        expires_at = parse_utc(value)
    except ValueError as error:
        raise HTTPException(status_code=422, detail='La fecha de expiración no es válida.') from error
    if expires_at <= datetime.now(timezone.utc):
        raise HTTPException(status_code=422, detail='La autorización debe vencer en el futuro.')
    return expires_at.astimezone(timezone.utc)


def create_authorization(
    project: str,
    subject: str,
    scopes: list[str],
    expires_at: datetime,
    renewed_from: str | None = None,
) -> dict[str, Any]:
    authorization_id = str(uuid.uuid4())
    key_id, private_key, _ = signing_key_pair()
    clean_scopes = sorted({scope.strip() for scope in scopes if scope.strip()})
    claims: dict[str, Any] = {
        'iss': 'xonetr',
        'kid': key_id,
        'jti': authorization_id,
        'project': project.strip(),
        'sub': subject.strip(),
        'scope': clean_scopes,
        'iat': utc_now(),
        'exp': expires_at.isoformat(),
    }
    if renewed_from:
        claims['renews'] = renewed_from
    signature = encode_base64(private_key.sign(canonical_json(claims)))
    with connection() as db:
        db.execute(
            """
            INSERT INTO authorizations
            (id, project, subject, scopes, payload, signature, issued_at, expires_at, renewed_from)
            VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                authorization_id,
                claims['project'],
                claims['sub'],
                json.dumps(clean_scopes),
                json.dumps(claims, ensure_ascii=False),
                signature,
                claims['iat'],
                claims['exp'],
                renewed_from,
            ),
        )
    return {
        'id': authorization_id,
        'project': claims['project'],
        'subject': claims['sub'],
        'scopes': clean_scopes,
        'issuedAt': claims['iat'],
        'expiresAt': claims['exp'],
        'renewedFrom': renewed_from,
        'keyId': key_id,
        'token': authorization_token(claims, signature),
    }


def authorization_status(row: sqlite3.Row) -> str:
    """active | expired | revoked | invalid (firma no verificable o clave revocada)."""
    if row['revoked_at']:
        return 'revoked'
    claims = json.loads(row['payload'])
    public_key = verification_key(claims.get('kid', ''))
    if public_key is None:
        return 'invalid'
    try:
        public_key.verify(decode_base64(row['signature']), canonical_json(claims))
    except InvalidSignature:
        return 'invalid'
    return 'expired' if parse_utc(claims['exp']) <= datetime.now(timezone.utc) else 'active'


def revoke_authorization_row(db: sqlite3.Connection, authorization_id: str, by: str, reason: str) -> None:
    db.execute(
        'UPDATE authorizations SET revoked_at = ?, revoked_by = ?, revoke_reason = ? WHERE id = ? AND revoked_at IS NULL',
        (utc_now(), by, reason or None, authorization_id),
    )


@app.get('/api/authorization/public-key')
def authorization_public_key():
    key_id, _, public_key = signing_key_pair()
    public_raw = public_key.public_bytes(serialization.Encoding.Raw, serialization.PublicFormat.Raw)
    return {'keyId': key_id, 'algorithm': 'Ed25519', 'publicKey': encode_base64(public_raw)}


@app.get('/api/authorization/public-keys')
def authorization_public_keys():
    """Todas las claves públicas: la activa, las rotadas (siguen verificando) y las revocadas (ya no)."""
    return {'keys': published_keys()}


@app.post('/api/authorization/keys/rotate')
def rotate_signing_key(session: str | None = Cookie(default=None, alias='admin_session')):
    require_admin(session)
    with connection() as db:
        key_id, _ = generate_signing_key(db)
    return {'keyId': key_id, 'keys': published_keys()}


@app.post('/api/authorization/keys/{key_id}/revoke')
def revoke_signing_key(key_id: str, session: str | None = Cookie(default=None, alias='admin_session')):
    """Para una clave comprometida: invalida todas las autorizaciones que firmó."""
    require_admin(session)
    with connection() as db:
        row = db.execute('SELECT id FROM signing_keys WHERE id = ?', (key_id,)).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail='La clave no existe.')
        db.execute('UPDATE signing_keys SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL', (utc_now(), key_id))
    return {'ok': True, 'keys': published_keys()}


@app.post('/api/authorizations')
def issue_authorization(payload: IssueAuthorization, session: str | None = Cookie(default=None, alias='admin_session')):
    admin = require_admin(session)
    expires_at = parse_future_expiry(payload.expires_at)
    issued = create_authorization(payload.project, payload.subject, payload.scopes, expires_at)
    return {**issued, 'issuer': admin['email']}


@app.get('/api/authorizations')
def list_authorizations(
    project: str | None = None,
    subject: str | None = None,
    session: str | None = Cookie(default=None, alias='admin_session'),
):
    require_admin(session)
    query = 'SELECT * FROM authorizations WHERE 1 = 1'
    params: list[str] = []
    if project:
        query += ' AND project = ?'
        params.append(project)
    if subject:
        query += ' AND subject = ?'
        params.append(subject)
    with connection() as db:
        rows = db.execute(query + ' ORDER BY issued_at DESC', params).fetchall()
    return [
        {
            'id': row['id'],
            'project': row['project'],
            'subject': row['subject'],
            'scopes': json.loads(row['scopes']),
            'issuedAt': row['issued_at'],
            'expiresAt': row['expires_at'],
            'revokedAt': row['revoked_at'],
            'revokedBy': row['revoked_by'],
            'revokeReason': row['revoke_reason'],
            'renewedFrom': row['renewed_from'],
            'status': authorization_status(row),
        }
        for row in rows
    ]


@app.get('/api/authorizations/{authorization_id}/token')
def authorization_token_for_admin(authorization_id: str, session: str | None = Cookie(default=None, alias='admin_session')):
    """Vuelve a entregar el token para cargarlo en el canal de secretos del despliegue del cliente."""
    require_admin(session)
    with connection() as db:
        row = db.execute('SELECT * FROM authorizations WHERE id = ?', (authorization_id,)).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail='La autorización no existe.')
    return {'id': row['id'], 'status': authorization_status(row), 'token': authorization_token(json.loads(row['payload']), row['signature'])}


@app.post('/api/authorizations/{authorization_id}/renew')
def renew_authorization(
    authorization_id: str,
    payload: RenewAuthorization,
    session: str | None = Cookie(default=None, alias='admin_session'),
):
    """Emite una autorización nueva para el mismo cliente y producto. La anterior sigue vigente hasta su
    vencimiento (así un backend que todavía no se enteró de la renovación no queda bloqueado), salvo que se
    pida revocarla. Con revoke_previous también sirve para cambiar (incluso acortar) el vencimiento."""
    admin = require_admin(session)
    with connection() as db:
        previous = db.execute('SELECT * FROM authorizations WHERE id = ?', (authorization_id,)).fetchone()
    if previous is None:
        raise HTTPException(status_code=404, detail='La autorización no existe.')
    if previous['revoked_at']:
        raise HTTPException(status_code=409, detail='No se puede renovar una autorización revocada; emití una nueva.')
    expires_at = parse_future_expiry(payload.expires_at)
    # Acortar solo es seguro si la anterior se revoca: si no, seguiría valiendo hasta su vencimiento más largo.
    if not payload.revoke_previous and expires_at <= parse_utc(previous['expires_at']):
        raise HTTPException(status_code=422, detail='La renovación debe vencer después que la autorización actual.')
    scopes = payload.scopes if payload.scopes is not None else json.loads(previous['scopes'])
    renewed = create_authorization(previous['project'], previous['subject'], scopes, expires_at, previous['id'])
    if payload.revoke_previous:
        with connection() as db:
            revoke_authorization_row(db, previous['id'], admin['email'], f'Reemplazada por {renewed["id"]}')
    return {**renewed, 'issuer': admin['email']}


@app.post('/api/authorizations/{authorization_id}/revoke')
def revoke_authorization(
    authorization_id: str,
    payload: RevokeAuthorization | None = None,
    session: str | None = Cookie(default=None, alias='admin_session'),
):
    admin = require_admin(session)
    with connection() as db:
        row = db.execute('SELECT id FROM authorizations WHERE id = ?', (authorization_id,)).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail='La autorización no existe.')
        revoke_authorization_row(db, authorization_id, admin['email'], payload.reason if payload else '')
    return {'ok': True}


@app.get('/api/authorizations/{authorization_id}/verify')
def verify_authorization(authorization_id: str):
    with connection() as db:
        row = db.execute('SELECT * FROM authorizations WHERE id = ?', (authorization_id,)).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail='La autorización no existe.')
    claims = json.loads(row['payload'])
    status = authorization_status(row)
    if status == 'invalid':
        raise HTTPException(status_code=400, detail='La firma criptográfica no es válida o su clave fue revocada.')
    return {
        'valid': status == 'active',
        'status': status,
        'authorization': claims,
        'algorithm': 'Ed25519',
        'keyId': claims['kid'],
    }


# ---------------------------------------------------------------- credenciales de los backends de cliente

def license_api_key(client_id: str, secret: str) -> str:
    return f'lic_{client_id}.{secret}'


def hash_license_secret(secret: str) -> str:
    # El secreto es aleatorio de 256 bits: un SHA-256 alcanza (no es una contraseña elegida por una persona).
    return hashlib.sha256(secret.encode()).hexdigest()


def require_license_client(request: Request) -> sqlite3.Row:
    header = request.headers.get('authorization', '')
    scheme, _, credential = header.partition(' ')
    if scheme.lower() != 'bearer' or not credential.startswith('lic_') or '.' not in credential:
        raise HTTPException(status_code=401, detail='Credencial de licencia requerida.')
    client_id, secret = credential[4:].split('.', 1)
    with connection() as db:
        row = db.execute('SELECT * FROM license_clients WHERE id = ?', (client_id,)).fetchone()
        if row is None or row['revoked_at'] or not hmac.compare_digest(row['secret_hash'], hash_license_secret(secret)):
            raise HTTPException(status_code=401, detail='Credencial de licencia inválida.')
        db.execute('UPDATE license_clients SET last_seen_at = ? WHERE id = ?', (utc_now(), client_id))
    return row


def serialize_license_client(row: sqlite3.Row) -> dict[str, Any]:
    return {
        'id': row['id'],
        'project': row['project'],
        'subject': row['subject'],
        'name': row['name'],
        'createdAt': row['created_at'],
        'createdBy': row['created_by'],
        'lastSeenAt': row['last_seen_at'],
        'revokedAt': row['revoked_at'],
        'status': 'revoked' if row['revoked_at'] else 'active',
    }


@app.post('/api/license-clients')
def create_license_client(payload: CreateLicenseClient, session: str | None = Cookie(default=None, alias='admin_session')):
    """Crea la credencial de un backend de cliente. La apiKey se devuelve solo esta vez."""
    admin = require_admin(session)
    client_id = str(uuid.uuid4())
    secret = encode_base64(os.urandom(32))
    with connection() as db:
        db.execute(
            'INSERT INTO license_clients(id, project, subject, name, secret_hash, created_at, created_by) VALUES(?, ?, ?, ?, ?, ?, ?)',
            (client_id, payload.project.strip(), payload.subject.strip(), payload.name.strip(),
             hash_license_secret(secret), utc_now(), admin['email']),
        )
        row = db.execute('SELECT * FROM license_clients WHERE id = ?', (client_id,)).fetchone()
    return {**serialize_license_client(row), 'apiKey': license_api_key(client_id, secret)}


@app.get('/api/license-clients')
def list_license_clients(session: str | None = Cookie(default=None, alias='admin_session')):
    require_admin(session)
    with connection() as db:
        rows = db.execute('SELECT * FROM license_clients ORDER BY created_at DESC').fetchall()
    return [serialize_license_client(row) for row in rows]


@app.post('/api/license-clients/{client_id}/rotate-secret')
def rotate_license_client_secret(client_id: str, session: str | None = Cookie(default=None, alias='admin_session')):
    require_admin(session)
    secret = encode_base64(os.urandom(32))
    with connection() as db:
        row = db.execute('SELECT * FROM license_clients WHERE id = ?', (client_id,)).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail='La credencial no existe.')
        if row['revoked_at']:
            raise HTTPException(status_code=409, detail='La credencial está revocada.')
        db.execute('UPDATE license_clients SET secret_hash = ? WHERE id = ?', (hash_license_secret(secret), client_id))
    return {**serialize_license_client(row), 'apiKey': license_api_key(client_id, secret)}


@app.post('/api/license-clients/{client_id}/revoke')
def revoke_license_client(client_id: str, session: str | None = Cookie(default=None, alias='admin_session')):
    require_admin(session)
    with connection() as db:
        row = db.execute('SELECT id FROM license_clients WHERE id = ?', (client_id,)).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail='La credencial no existe.')
        db.execute('UPDATE license_clients SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL', (utc_now(), client_id))
    return {'ok': True}


@app.post('/api/licenses/check')
def check_license(payload: LicenseCheck, request: Request):
    """Consulta del backend de un cliente (autenticada con su apiKey). Devuelve:
    - current: estado de la autorización que el cliente tiene en uso (jti);
    - latest: la autorización vigente que vence más tarde para ese cliente y producto (la renovación, si hay);
    - revoked: autorizaciones revocadas de ese cliente, para que deje de aceptarlas;
    - keys: claves públicas (activas, rotadas y revocadas) para verificar firmas localmente.
    Una credencial solo ve las autorizaciones de su propio cliente y producto."""
    client = require_license_client(request)
    if payload.project != client['project']:
        raise HTTPException(status_code=403, detail='La credencial no corresponde a este producto.')
    with connection() as db:
        rows = db.execute(
            'SELECT * FROM authorizations WHERE project = ? AND subject = ? ORDER BY expires_at DESC',
            (client['project'], client['subject']),
        ).fetchall()
    statuses = {row['id']: authorization_status(row) for row in rows}
    latest = next((row for row in rows if statuses[row['id']] == 'active'), None)
    current = None
    if payload.jti:
        row = next((row for row in rows if row['id'] == payload.jti), None)
        current = {'jti': payload.jti, 'status': statuses[row['id']] if row else 'unknown'}
    return {
        'serverTime': utc_now(),
        'project': client['project'],
        'subject': client['subject'],
        'current': current,
        'latest': None if latest is None else {
            'jti': latest['id'],
            'expiresAt': latest['expires_at'],
            'token': authorization_token(json.loads(latest['payload']), latest['signature']),
        },
        'revoked': [row['id'] for row in rows if statuses[row['id']] in ('revoked', 'invalid')],
        'keys': published_keys(),
    }


@app.post('/api/auth/register')
def register_user(payload: dict[str, Any]):
    name = str(payload.get('name', '')).strip()
    email = str(payload.get('email', '')).strip().lower()
    password = str(payload.get('password', ''))
    role = 'viewer'

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
    require_admin(session)
    with connection() as db:
        rows = db.execute(
            'SELECT * FROM users WHERE active = 1 ORDER BY created_at DESC'
        ).fetchall()
    return [serialize_user(row) for row in rows]


@app.post('/api/users')
def create_managed_user(payload: dict[str, Any], session: str | None = Cookie(default=None, alias='admin_session')):
    current_user = require_admin(session)
    name = str(payload.get('name', '')).strip()
    email = str(payload.get('email', '')).strip().lower()
    password = str(payload.get('password', ''))
    role = str(payload.get('role', 'viewer')).strip().lower()

    if not name or not email or len(password) < 6:
        raise HTTPException(status_code=400, detail='Nombre, email y contraseña válida son obligatorios.')
    if role not in {'admin', 'developer', 'viewer'}:
        raise HTTPException(status_code=400, detail='El rol no es válido.')
    if not current_user.get('is_root') and role == 'admin':
        raise HTTPException(status_code=403, detail='Solo el administrador raíz puede crear cuentas administrativas.')
    if get_user_by_email(email) is not None:
        raise HTTPException(status_code=409, detail='Ya existe un usuario con ese email.')

    user_id = str(uuid.uuid4())
    now = utc_now()
    with connection() as db:
        db.execute(
            'INSERT INTO users(id, name, email, password_hash, role, created_at, active, is_root) VALUES(?, ?, ?, ?, ?, ?, 1, 0)',
            (user_id, name, email, hash_password(password), role, now),
        )
    user = get_user_by_id(user_id)
    if user is None:
        raise HTTPException(status_code=500, detail='No se pudo crear el usuario.')
    return serialize_user(user)


@app.patch('/api/users/{user_id}')
def update_user(user_id: str, payload: dict[str, Any], session: str | None = Cookie(default=None, alias='admin_session')):
    current_user = require_admin(session)
    target = get_user_by_id(user_id)
    if target is None:
        raise HTTPException(status_code=404, detail='Usuario no encontrado.')
    if user_is_root(target):
        raise HTTPException(status_code=403, detail='El administrador raíz es inmutable.')

    next_role = str(payload.get('role', target['role'])).strip().lower()
    next_active = payload.get('active', bool(target['active']))

    if next_role not in {'admin', 'developer', 'viewer'}:
        raise HTTPException(status_code=400, detail='El rol no es válido.')
    if next_role == 'admin' and not current_user.get('is_root'):
        raise HTTPException(status_code=403, detail='Solo el administrador raíz puede asignar permisos administrativos.')
    if next_active is None:
        next_active = bool(target['active'])
    if not bool(next_active) and user_is_root(target):
        raise HTTPException(status_code=403, detail='El administrador raíz no puede desactivarse.')

    with connection() as db:
        db.execute(
            'UPDATE users SET role = ?, active = ? WHERE id = ?',
            (next_role, int(bool(next_active)), user_id),
        )
    updated = get_user_by_id(user_id)
    return serialize_user(updated)


@app.delete('/api/users/{user_id}')
def delete_user(user_id: str, session: str | None = Cookie(default=None, alias='admin_session')):
    current_user = require_admin(session)
    target = get_user_by_id(user_id)
    if target is None:
        raise HTTPException(status_code=404, detail='Usuario no encontrado.')
    if user_is_root(target):
        raise HTTPException(status_code=403, detail='El administrador raíz es inmutable.')
    if not current_user.get('is_root') and target['role'] == 'admin':
        raise HTTPException(status_code=403, detail='Solo el administrador raíz puede eliminar cuentas administrativas.')

    with connection() as db:
        db.execute('UPDATE users SET active = 0 WHERE id = ?', (user_id,))
    return {'ok': True}


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
def record_visit(payload: dict[str, Any], request: Request):
    event_type = str(payload.get('event_type', 'page_view')).strip().lower() or 'page_view'
    path = str(payload.get('path', '/')).strip() or '/'
    project_id = payload.get('project_id')
    session_id = payload.get('session_id')
    referrer = payload.get('referrer')
    user_agent = payload.get('user_agent')
    forwarded_for = request.headers.get('x-forwarded-for')
    ip = forwarded_for.split(',', 1)[0].strip() if forwarded_for else request.client.host if request.client else None
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
    previous_since = (datetime.now(timezone.utc) - timedelta(days=days * 2)).isoformat()
    month_start = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()

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
        previous_visits = db.execute(
            'SELECT COUNT(*) AS value FROM visit_events WHERE created_at >= ? AND created_at < ?',
            (previous_since, since),
        ).fetchone()['value']
        published_changes_month = db.execute(
            'SELECT COUNT(*) AS value FROM versions WHERE created_at >= ?',
            (month_start,),
        ).fetchone()['value']
        published_changes_week = db.execute(
            'SELECT COUNT(*) AS value FROM versions WHERE created_at >= ?',
            (since,),
        ).fetchone()['value']
        last_published = db.execute(
            'SELECT created_at FROM versions ORDER BY created_at DESC LIMIT 1'
        ).fetchone()

    visit_change = 0
    if previous_visits:
        visit_change = round(((total_visits - previous_visits) / previous_visits) * 100)

    return {
        'range_days': days,
        'total_visits': total_visits,
        'unique_visitors': unique_visitors,
        'active_projects': active_projects,
        'open_tasks': open_tasks,
        'task_status': [{'status': row['status'], 'total': row['total']} for row in task_status],
        'visits_by_day': [{'day': row['day'], 'total': row['total']} for row in visits_by_day],
        'visit_change_percent': visit_change,
        'published_changes_month': published_changes_month,
        'published_changes_week': published_changes_week,
        'last_published_at': last_published['created_at'] if last_published else None,
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


CONTENT_SECTION_LABELS = {
    'navigation': 'Navegación',
    'hero': 'Inicio',
    'whatWeDo': '¿Qué hacemos?',
    'services': '¿Qué ofrecemos?',
    'process': '¿Cómo trabajamos?',
    'projects': 'Proyectos',
    'pricing': 'Precios',
    'team': 'Equipo',
    'purpose': '¿Qué queremos?',
    'faq': 'FAQ',
    'contact': 'Contacto',
    'footer': 'Pie de página',
    'legal': 'Textos legales',
    'settings': 'Ajustes del sitio',
    'brand': 'Marca',
}


def changed_content_sections(current: dict[str, Any], previous: dict[str, Any] | None) -> list[str]:
    if previous is None:
        return [CONTENT_SECTION_LABELS.get(key, key) for key in current.keys()]
    return [
        CONTENT_SECTION_LABELS.get(key, key)
        for key in current.keys()
        if current.get(key) != previous.get(key)
    ]


def summarize_sections(sections: list[str]) -> str:
    if not sections:
        return 'Publicación sin cambios'
    if len(sections) <= 3:
        return ', '.join(sections)
    return f'{len(sections)} secciones modificadas'


@app.post('/api/content/publish')
def publish(session: str | None = Cookie(default=None, alias='admin_session')):
    user = require_admin(session)
    with connection() as db:
        draft = db.execute("SELECT content FROM site_content WHERE kind = 'draft'").fetchone()
        published = db.execute("SELECT content FROM site_content WHERE kind = 'published'").fetchone()
        if draft is None:
            raise HTTPException(status_code=404, detail='No hay borrador para publicar.')

        content = draft['content']
        next_content = json.loads(content)
        previous_content = json.loads(published['content']) if published else None
        changed_sections = changed_content_sections(next_content, previous_content)
        db.execute(
            """
            INSERT INTO site_content(kind, content, updated_at) VALUES('published', ?, ?)
            ON CONFLICT(kind) DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at
            """,
            (content, utc_now()),
        )
        db.execute(
            'INSERT INTO versions(id, created_at, summary, author, changed_sections, author_name, author_email, content) VALUES(?, ?, ?, ?, ?, ?, ?, ?)',
            (
                str(uuid.uuid4()),
                utc_now(),
                summarize_sections(changed_sections),
                user['name'],
                json.dumps(changed_sections, ensure_ascii=False),
                user['name'],
                user['email'],
                content,
            ),
        )
        db.execute("DELETE FROM versions WHERE id NOT IN (SELECT id FROM versions ORDER BY created_at DESC LIMIT 10)")
        db.execute("DELETE FROM site_content WHERE kind = 'draft'")
    return {'ok': True}


@app.get('/api/content/versions')
def list_versions(session: str | None = Cookie(default=None, alias='admin_session')):
    require_admin(session)
    with connection() as db:
        rows = db.execute(
            'SELECT id, created_at AS createdAt, summary, author, changed_sections AS changedSections, author_name AS authorName, author_email AS authorEmail FROM versions ORDER BY created_at DESC LIMIT 10'
        ).fetchall()
    result = []
    for row in rows:
        item = dict(row)
        try:
            item['changedSections'] = json.loads(item.get('changedSections') or '[]')
        except json.JSONDecodeError:
            item['changedSections'] = []
        if not item.get('authorName'):
            item['authorName'] = 'Administrador' if '@' in item.get('author', '') else item.get('author')
        if not item.get('authorEmail') and '@' in item.get('author', ''):
            item['authorEmail'] = item['author']
        result.append(item)
    return result


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


ALLOWED_TYPES = {'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'image/svg+xml': '.svg', 'image/gif': '.gif'}
MAX_RESULT_BYTES = 2 * 1024 * 1024
MAX_ORIGINAL_BYTES = 10 * 1024 * 1024


@app.post('/api/media')
async def upload_media(
    file: UploadFile = File(...),
    original: UploadFile | None = File(default=None),
    edit: str | None = Form(default=None),
    session: str | None = Cookie(default=None, alias='admin_session'),
):
    require_admin(session)
    extension = ALLOWED_TYPES.get(file.content_type or '')
    if extension is None:
        raise HTTPException(status_code=400, detail='Usa una imagen PNG, JPG, WebP, SVG o GIF.')
    data = await file.read()
    passthrough = file.content_type in {'image/svg+xml', 'image/gif'}
    if len(data) > (MAX_ORIGINAL_BYTES if passthrough else MAX_RESULT_BYTES):
        raise HTTPException(status_code=400, detail='La imagen no puede superar 10 MB.' if passthrough else 'La imagen resultante no puede superar 2 MB.')

    original_data: bytes | None = None
    original_extension: str | None = None
    if original is not None:
        original_extension = ALLOWED_TYPES.get(original.content_type or '')
        if original_extension is None:
            raise HTTPException(status_code=400, detail='El original debe ser PNG, JPG, WebP, SVG o GIF.')
        original_data = await original.read()
        if len(original_data) > MAX_ORIGINAL_BYTES:
            raise HTTPException(status_code=400, detail='La imagen original no puede superar 10 MB.')

    edit_payload: dict[str, Any] | None = None
    if edit:
        try:
            parsed_edit = json.loads(edit)
            if not isinstance(parsed_edit, dict):
                raise ValueError
            edit_payload = parsed_edit
        except (json.JSONDecodeError, ValueError):
            raise HTTPException(status_code=400, detail='Los datos de edición no son válidos.')

    media_id = str(uuid.uuid4())
    filename = f'{media_id}{extension}'
    (MEDIA_DIRECTORY / filename).write_bytes(data)
    original_filename = f'{media_id}-original{original_extension}' if original_data is not None and original_extension else None
    if original_filename and original_data is not None:
        (MEDIA_DIRECTORY / original_filename).write_bytes(original_data)
    created_at = utc_now()
    with connection() as db:
        db.execute(
            'INSERT INTO media(id, name, size, type, filename, original_filename, original_size, original_type, edit, created_at) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            (media_id, file.filename or filename, len(data), file.content_type, filename, original_filename, len(original_data) if original_data is not None else None, original.content_type if original is not None else None, json.dumps(edit_payload, ensure_ascii=False) if edit_payload else None, created_at),
        )
    return {'url': f'/api/media/{media_id}', 'original': f'/api/media/{media_id}/original' if original_filename else None}


@app.get('/api/media')
def list_media(session: str | None = Cookie(default=None, alias='admin_session')):
    require_admin(session)
    with connection() as db:
        rows = db.execute(
            'SELECT id, name, size, type, original_filename, edit, created_at AS createdAt FROM media ORDER BY created_at DESC'
        ).fetchall()
    result = []
    for row in rows:
        item = dict(row)
        item['url'] = f"/api/media/{row['id']}"
        item['originalUrl'] = f"/api/media/{row['id']}/original" if item.pop('original_filename', None) else None
        try:
            item['edit'] = json.loads(item['edit']) if item.get('edit') else None
        except json.JSONDecodeError:
            item['edit'] = None
        result.append(item)
    return result


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


@app.get('/api/media/{media_id}/original')
def get_original_media(media_id: str):
    with connection() as db:
        row = db.execute('SELECT original_filename, original_type FROM media WHERE id = ?', (media_id,)).fetchone()
    if row is None or not row['original_filename']:
        raise HTTPException(status_code=404, detail='Archivo original no encontrado.')
    path = MEDIA_DIRECTORY / row['original_filename']
    if not path.exists():
        raise HTTPException(status_code=404, detail='Archivo original no encontrado.')
    return FileResponse(path, media_type=row['original_type'])


@app.delete('/api/media/{media_id}')
def delete_media(media_id: str, session: str | None = Cookie(default=None, alias='admin_session')):
    require_admin(session)
    with connection() as db:
        row = db.execute('SELECT filename, original_filename FROM media WHERE id = ?', (media_id,)).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail='Archivo no encontrado.')
        db.execute('DELETE FROM media WHERE id = ?', (media_id,))
    path = MEDIA_DIRECTORY / row['filename']
    if path.exists():
        path.unlink()
    if row['original_filename']:
        original_path = MEDIA_DIRECTORY / row['original_filename']
        if original_path.exists():
            original_path.unlink()
    return {'ok': True}
