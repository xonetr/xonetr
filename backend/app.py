import hashlib
import hmac
import json
import os
import sqlite3
import uuid
import base64
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import Cookie, FastAPI, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey, Ed25519PublicKey
from pydantic import BaseModel, Field


ROOT = Path(__file__).resolve().parent.parent


def project_path(value: str | Path) -> Path:
    path = Path(value)
    return path if path.is_absolute() else ROOT / path


DATABASE_PATH = project_path(os.getenv("DATABASE_PATH", "backend/data/xonetr.sqlite3"))
MEDIA_DIRECTORY = project_path(os.getenv("MEDIA_DIRECTORY", "backend/data/media"))
SESSION_SECRET = os.getenv("SESSION_SECRET", "development-session-secret-change-me")
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@xonetr.com")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin123")
CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")
    if origin.strip()
]

DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)
MEDIA_DIRECTORY.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="XONETR API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def connection() -> sqlite3.Connection:
    db = sqlite3.connect(DATABASE_PATH)
    db.row_factory = sqlite3.Row
    return db


def initialize_database() -> None:
    with connection() as db:
        db.executescript(
            """
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


initialize_database()


def signing_key_pair() -> tuple[str, Ed25519PrivateKey, Ed25519PublicKey]:
    with connection() as db:
        row = db.execute(
            "SELECT id, private_key FROM signing_keys WHERE revoked_at IS NULL ORDER BY created_at DESC LIMIT 1"
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
                "INSERT INTO signing_keys(id, private_key, public_key, created_at) VALUES(?, ?, ?, ?)",
                (key_id, base64.urlsafe_b64encode(private_raw).decode().rstrip("="),
                 base64.urlsafe_b64encode(public_raw).decode().rstrip("="), utc_now()),
            )
            return key_id, private_key, private_key.public_key()
        private_raw = base64.urlsafe_b64decode(row["private_key"] + "=" * (-len(row["private_key"]) % 4))
        private_key = Ed25519PrivateKey.from_private_bytes(private_raw)
        return row["id"], private_key, private_key.public_key()


def encode_base64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode().rstrip("=")


def decode_base64(data: str) -> bytes:
    return base64.urlsafe_b64decode(data + "=" * (-len(data) % 4))


def sign(value: str) -> str:
    signature = hmac.new(SESSION_SECRET.encode(), value.encode(), hashlib.sha256).hexdigest()
    return f"{value}.{signature}"


def verify_signed(value: str) -> str | None:
    try:
        payload, signature = value.rsplit(".", 1)
    except ValueError:
        return None
    expected = hmac.new(SESSION_SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()
    return payload if hmac.compare_digest(signature, expected) else None


def require_admin(session: str | None = Cookie(default=None)) -> dict[str, str]:
    email = verify_signed(session) if session else None
    if email != ADMIN_EMAIL:
        raise HTTPException(status_code=401, detail="No autenticado.")
    return {"email": email}


def json_content(row: sqlite3.Row | None) -> dict[str, Any] | None:
    return json.loads(row["content"]) if row else None


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


class IssueAuthorization(BaseModel):
    project: str = Field(min_length=1)
    subject: str = Field(min_length=1)
    scopes: list[str] = Field(default_factory=list)
    expires_at: str = Field(min_length=1)


def authorization_token(payload: dict[str, Any], signature: str) -> str:
    raw_payload = json.dumps(payload, ensure_ascii=False, separators=(",", ":"), sort_keys=True).encode()
    return f"{encode_base64(raw_payload)}.{signature}"


@app.get("/api/authorization/public-key")
def authorization_public_key():
    key_id, _, public_key = signing_key_pair()
    public_raw = public_key.public_bytes(serialization.Encoding.Raw, serialization.PublicFormat.Raw)
    return {"keyId": key_id, "algorithm": "Ed25519", "publicKey": encode_base64(public_raw)}


@app.post("/api/authorizations")
def issue_authorization(payload: IssueAuthorization, session: str | None = Cookie(default=None, alias="admin_session")):
    admin = require_admin(session)
    try:
        expires_at = datetime.fromisoformat(payload.expires_at.replace("Z", "+00:00"))
    except ValueError as error:
        raise HTTPException(status_code=422, detail="La fecha de expiración no es válida.") from error
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at <= datetime.now(timezone.utc):
        raise HTTPException(status_code=422, detail="La autorización debe vencer en el futuro.")

    authorization_id = str(uuid.uuid4())
    key_id, private_key, _ = signing_key_pair()
    claims = {
        "iss": "xonetr",
        "kid": key_id,
        "jti": authorization_id,
        "project": payload.project,
        "sub": payload.subject,
        "scope": payload.scopes,
        "iat": utc_now(),
        "exp": expires_at.isoformat(),
    }
    payload_bytes = json.dumps(claims, ensure_ascii=False, separators=(",", ":"), sort_keys=True).encode()
    signature = encode_base64(private_key.sign(payload_bytes))
    with connection() as db:
        db.execute(
            """
            INSERT INTO authorizations
            (id, project, subject, scopes, payload, signature, issued_at, expires_at)
            VALUES(?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (authorization_id, payload.project, payload.subject, json.dumps(payload.scopes),
             json.dumps(claims, ensure_ascii=False), signature, claims["iat"], claims["exp"]),
        )
    return {
        "id": authorization_id,
        "project": payload.project,
        "subject": payload.subject,
        "scopes": payload.scopes,
        "issuedAt": claims["iat"],
        "expiresAt": claims["exp"],
        "issuer": admin["email"],
        "token": authorization_token(claims, signature),
    }


@app.get("/api/authorizations")
def list_authorizations(session: str | None = Cookie(default=None, alias="admin_session")):
    require_admin(session)
    with connection() as db:
        rows = db.execute(
            """
            SELECT id, project, subject, scopes, issued_at AS issuedAt, expires_at AS expiresAt,
                   revoked_at AS revokedAt, revoked_by AS revokedBy
            FROM authorizations ORDER BY issued_at DESC
            """
        ).fetchall()
    return [{**dict(row), "scopes": json.loads(row["scopes"]), "status": "revoked" if row["revokedAt"] else "active"}
            for row in rows]


@app.post("/api/authorizations/{authorization_id}/revoke")
def revoke_authorization(
    authorization_id: str,
    session: str | None = Cookie(default=None, alias="admin_session"),
):
    admin = require_admin(session)
    with connection() as db:
        row = db.execute("SELECT id FROM authorizations WHERE id = ?", (authorization_id,)).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="La autorización no existe.")
        db.execute(
            "UPDATE authorizations SET revoked_at = ?, revoked_by = ? WHERE id = ?",
            (utc_now(), admin["email"], authorization_id),
        )
    return {"ok": True}


@app.get("/api/authorizations/{authorization_id}/verify")
def verify_authorization(authorization_id: str):
    with connection() as db:
        row = db.execute(
            "SELECT payload, signature, revoked_at, expires_at FROM authorizations WHERE id = ?",
            (authorization_id,),
        ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="La autorización no existe.")

    claims = json.loads(row["payload"])
    key_id, _, public_key = signing_key_pair()
    try:
        public_key.verify(decode_base64(row["signature"]), json.dumps(
            claims, ensure_ascii=False, separators=(",", ":"), sort_keys=True
        ).encode())
    except Exception as error:
        raise HTTPException(status_code=400, detail="La firma criptográfica no es válida.") from error

    revoked = row["revoked_at"] is not None
    expires_at = datetime.fromisoformat(claims["exp"].replace("Z", "+00:00"))
    expired = expires_at <= datetime.now(timezone.utc)
    valid = not revoked and not expired and claims["kid"] == key_id
    return {
        "valid": valid,
        "status": "revoked" if revoked else "expired" if expired else "active",
        "authorization": claims,
        "algorithm": "Ed25519",
        "keyId": claims["kid"],
    }


@app.post("/api/auth/login")
def login(payload: dict[str, Any]):
    email = str(payload.get("email", "")).strip().lower()
    password = str(payload.get("password", ""))
    if email != ADMIN_EMAIL.lower() or not hmac.compare_digest(password, ADMIN_PASSWORD):
        raise HTTPException(status_code=401, detail="El correo o la contraseña no son correctos.")

    from fastapi.responses import JSONResponse

    result = JSONResponse({"email": ADMIN_EMAIL, "signedInAt": utc_now()})
    result.set_cookie(
        "admin_session",
        sign(ADMIN_EMAIL),
        httponly=True,
        secure=os.getenv("COOKIE_SECURE", "false").lower() == "true",
        samesite="lax",
        max_age=60 * 60 * 8,
    )
    return result


@app.post("/api/auth/logout")
def logout():
    from fastapi.responses import JSONResponse

    result = JSONResponse({"ok": True})
    result.delete_cookie("admin_session")
    return result


@app.get("/api/auth/session")
def session(session: str | None = Cookie(default=None, alias="admin_session")):
    email = require_admin(session)["email"]
    return {"email": email, "signedInAt": utc_now()}


@app.get("/api/content/published")
def published_content():
    with connection() as db:
        row = db.execute("SELECT content FROM site_content WHERE kind = 'published'").fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Todavía no hay contenido publicado.")
    return json.loads(row["content"])


@app.get("/api/content/draft")
def draft_content(session: str | None = Cookie(default=None, alias="admin_session")):
    require_admin(session)
    with connection() as db:
        row = db.execute("SELECT content FROM site_content WHERE kind = 'draft'").fetchone()
        if row is None:
            row = db.execute("SELECT content FROM site_content WHERE kind = 'published'").fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="No hay borrador disponible.")
    return json.loads(row["content"])


@app.put("/api/content/draft")
def save_draft(payload: dict[str, Any], session: str | None = Cookie(default=None, alias="admin_session")):
    require_admin(session)
    with connection() as db:
        db.execute(
            """
            INSERT INTO site_content(kind, content, updated_at) VALUES('draft', ?, ?)
            ON CONFLICT(kind) DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at
            """,
            (json.dumps(payload, ensure_ascii=False), utc_now()),
        )
    return {"ok": True}


@app.delete("/api/content/draft")
def discard_draft(session: str | None = Cookie(default=None, alias="admin_session")):
    require_admin(session)
    with connection() as db:
        db.execute("DELETE FROM site_content WHERE kind = 'draft'")
    return {"ok": True}


@app.post("/api/content/publish")
def publish(session: str | None = Cookie(default=None, alias="admin_session")):
    require_admin(session)
    with connection() as db:
        draft = db.execute("SELECT content FROM site_content WHERE kind = 'draft'").fetchone()
        published = db.execute("SELECT content FROM site_content WHERE kind = 'published'").fetchone()
        if draft is None:
            raise HTTPException(status_code=404, detail="No hay borrador para publicar.")

        content = draft["content"]
        db.execute(
            """
            INSERT INTO site_content(kind, content, updated_at) VALUES('published', ?, ?)
            ON CONFLICT(kind) DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at
            """,
            (content, utc_now()),
        )
        changed = json.loads(content) != json.loads(published["content"]) if published else True
        db.execute(
            "INSERT INTO versions(id, created_at, summary, author, content) VALUES(?, ?, ?, ?, ?)",
            (
                str(uuid.uuid4()),
                utc_now(),
                "Cambios publicados" if changed else "Publicación sin cambios",
                ADMIN_EMAIL,
                content,
            ),
        )
        db.execute("DELETE FROM versions WHERE id NOT IN (SELECT id FROM versions ORDER BY created_at DESC LIMIT 10)")
        db.execute("DELETE FROM site_content WHERE kind = 'draft'")
    return {"ok": True}


@app.get("/api/content/versions")
def list_versions(session: str | None = Cookie(default=None, alias="admin_session")):
    require_admin(session)
    with connection() as db:
        rows = db.execute(
            "SELECT id, created_at AS createdAt, summary, author FROM versions ORDER BY created_at DESC LIMIT 10"
        ).fetchall()
    return [dict(row) for row in rows]


@app.get("/api/content/versions/{version_id}")
def get_version(version_id: str, session: str | None = Cookie(default=None, alias="admin_session")):
    require_admin(session)
    with connection() as db:
        row = db.execute("SELECT content FROM versions WHERE id = ?", (version_id,)).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="La versión solicitada no existe.")
    return json.loads(row["content"])


@app.post("/api/content/versions/{version_id}/restore")
def restore_version(version_id: str, session: str | None = Cookie(default=None, alias="admin_session")):
    require_admin(session)
    with connection() as db:
        row = db.execute("SELECT content FROM versions WHERE id = ?", (version_id,)).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="La versión solicitada no existe.")
        db.execute(
            """
            INSERT INTO site_content(kind, content, updated_at) VALUES('draft', ?, ?)
            ON CONFLICT(kind) DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at
            """,
            (row["content"], utc_now()),
        )
    return {"ok": True}


ALLOWED_TYPES = {"image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp", "image/svg+xml": ".svg"}


@app.post("/api/media")
async def upload_media(file: UploadFile, session: str | None = Cookie(default=None, alias="admin_session")):
    require_admin(session)
    extension = ALLOWED_TYPES.get(file.content_type or "")
    if extension is None:
        raise HTTPException(status_code=400, detail="Usa una imagen PNG, JPG, WebP o SVG.")
    data = await file.read()
    if len(data) > 2 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="La imagen no puede superar 2 MB.")

    media_id = str(uuid.uuid4())
    filename = f"{media_id}{extension}"
    (MEDIA_DIRECTORY / filename).write_bytes(data)
    created_at = utc_now()
    with connection() as db:
        db.execute(
            "INSERT INTO media(id, name, size, type, filename, created_at) VALUES(?, ?, ?, ?, ?, ?)",
            (media_id, file.filename or filename, len(data), file.content_type, filename, created_at),
        )
    return {"url": f"/api/media/{media_id}"}


@app.get("/api/media")
def list_media(session: str | None = Cookie(default=None, alias="admin_session")):
    require_admin(session)
    with connection() as db:
        rows = db.execute(
            "SELECT id, name, size, type, created_at AS createdAt FROM media ORDER BY created_at DESC"
        ).fetchall()
    return [{**dict(row), "url": f"/api/media/{row['id']}"} for row in rows]


@app.get("/api/media/{media_id}")
def get_media(media_id: str):
    with connection() as db:
        row = db.execute("SELECT filename, type FROM media WHERE id = ?", (media_id,)).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Archivo no encontrado.")
    path = MEDIA_DIRECTORY / row["filename"]
    if not path.exists():
        raise HTTPException(status_code=404, detail="Archivo no encontrado.")
    return FileResponse(path, media_type=row["type"])


@app.delete("/api/media/{media_id}")
def delete_media(media_id: str, session: str | None = Cookie(default=None, alias="admin_session")):
    require_admin(session)
    with connection() as db:
        row = db.execute("SELECT filename FROM media WHERE id = ?", (media_id,)).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Archivo no encontrado.")
        db.execute("DELETE FROM media WHERE id = ?", (media_id,))
    path = MEDIA_DIRECTORY / row["filename"]
    if path.exists():
        path.unlink()
    return {"ok": True}
