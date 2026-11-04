import base64
import json
import sqlite3
from datetime import datetime, timedelta, timezone

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
from fastapi.testclient import TestClient

import backend.app as api
from backend.test_api import build_client


def b64decode(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


def admin_client():
    client = build_client()
    login = client.post("/api/auth/login", json={"email": api.ADMIN_EMAIL, "password": api.ADMIN_PASSWORD})
    assert login.status_code == 200, login.text
    client.cookies.set("admin_session", login.cookies.get("admin_session"))
    return client


def in_days(days: int) -> str:
    return (datetime.now(timezone.utc) + timedelta(days=days)).isoformat()


def issue(client, subject="club-a", days=30, scopes=("jugadores", "asistencia")):
    response = client.post(
        "/api/authorizations",
        json={"project": "escfutboll", "subject": subject, "scopes": list(scopes), "expires_at": in_days(days)},
    )
    assert response.status_code == 200, response.text
    return response.json()


def verify_token(token: str, keys: list[dict]) -> dict:
    payload_b64, signature_b64 = token.split(".")
    payload = b64decode(payload_b64)
    claims = json.loads(payload)
    key = next(k for k in keys if k["keyId"] == claims["kid"])
    Ed25519PublicKey.from_public_bytes(b64decode(key["publicKey"])).verify(b64decode(signature_b64), payload)
    return claims


def test_private_keys_are_encrypted_at_rest():
    client = admin_client()
    issue(client)
    with sqlite3.connect(api.DATABASE_PATH) as db:
        stored = [row[0] for row in db.execute("SELECT private_key FROM signing_keys")]
    assert stored and all(value.startswith(api.ENCRYPTED_KEY_PREFIX) for value in stored)


def test_plaintext_keys_from_previous_versions_are_migrated():
    client = admin_client()
    issued = issue(client)
    with sqlite3.connect(api.DATABASE_PATH) as db:
        db.row_factory = sqlite3.Row
        row = db.execute("SELECT id, private_key FROM signing_keys").fetchone()
        raw = api.unseal_private_key(row["private_key"])
        db.execute("UPDATE signing_keys SET private_key = ? WHERE id = ?", (api.encode_base64(raw), row["id"]))
    api.initialize_database()
    with sqlite3.connect(api.DATABASE_PATH) as db:
        stored = db.execute("SELECT private_key FROM signing_keys").fetchone()[0]
    assert stored.startswith(api.ENCRYPTED_KEY_PREFIX)
    assert client.get(f"/api/authorizations/{issued['id']}/verify").json()["valid"] is True


def test_rotation_keeps_previous_authorizations_valid_and_key_revocation_invalidates_them():
    client = admin_client()
    old = issue(client)
    rotated = client.post("/api/authorization/keys/rotate")
    assert rotated.status_code == 200, rotated.text
    new = issue(client, subject="club-b")
    assert new["keyId"] != old["keyId"]

    assert client.get(f"/api/authorizations/{old['id']}/verify").json()["valid"] is True
    keys = client.get("/api/authorization/public-keys").json()["keys"]
    assert {k["status"] for k in keys} == {"active", "retired"}
    assert verify_token(old["token"], keys)["sub"] == "club-a"

    assert client.post(f"/api/authorization/keys/{old['keyId']}/revoke").status_code == 200
    assert client.get(f"/api/authorizations/{old['id']}/verify").status_code == 400
    assert client.get(f"/api/authorizations/{new['id']}/verify").json()["valid"] is True


def test_renewal_issues_linked_authorization_and_keeps_previous_until_expiry():
    client = admin_client()
    first = issue(client, days=10)
    too_short = client.post(f"/api/authorizations/{first['id']}/renew", json={"expires_at": in_days(5)})
    assert too_short.status_code == 422

    renewed = client.post(f"/api/authorizations/{first['id']}/renew", json={"expires_at": in_days(400)})
    assert renewed.status_code == 200, renewed.text
    body = renewed.json()
    assert body["renewedFrom"] == first["id"]
    assert body["scopes"] == ["asistencia", "jugadores"]
    claims = verify_token(body["token"], client.get("/api/authorization/public-keys").json()["keys"])
    assert claims["renews"] == first["id"] and claims["sub"] == "club-a"

    statuses = {a["id"]: a["status"] for a in client.get("/api/authorizations?subject=club-a").json()}
    assert statuses == {first["id"]: "active", body["id"]: "active"}


def test_renewal_with_revoke_previous_can_shorten_expiry():
    client = admin_client()
    first = issue(client, days=60)
    shorter = client.post(
        f"/api/authorizations/{first['id']}/renew", json={"expires_at": in_days(10), "revoke_previous": True}
    )
    assert shorter.status_code == 200, shorter.text
    statuses = {a["id"]: a["status"] for a in client.get("/api/authorizations?subject=club-a").json()}
    assert statuses == {first["id"]: "revoked", shorter.json()["id"]: "active"}


def test_admin_endpoints_require_admin():
    client = build_client()
    assert client.post("/api/authorization/keys/rotate").status_code == 401
    assert client.post("/api/license-clients", json={"project": "escfutboll", "subject": "x"}).status_code == 401


def test_client_backend_check_sees_renewals_and_revocations_of_its_own_subject_only():
    client = admin_client()
    current = issue(client, subject="club-a", days=5)
    other = issue(client, subject="club-b", days=500)
    credential = client.post("/api/license-clients", json={"project": "escfutboll", "subject": "club-a", "name": "Club A"})
    assert credential.status_code == 200, credential.text
    api_key = credential.json()["apiKey"]
    assert "secret_hash" not in credential.json()

    anonymous = TestClient(api.app)
    assert anonymous.post("/api/licenses/check", json={"project": "escfutboll"}).status_code == 401
    bad = {"Authorization": "Bearer " + api_key[:-2] + "xx"}
    assert anonymous.post("/api/licenses/check", json={"project": "escfutboll"}, headers=bad).status_code == 401
    headers = {"Authorization": f"Bearer {api_key}"}
    assert anonymous.post("/api/licenses/check", json={"project": "otro"}, headers=headers).status_code == 403

    check = anonymous.post("/api/licenses/check", json={"project": "escfutboll", "jti": current["id"]}, headers=headers)
    assert check.status_code == 200, check.text
    data = check.json()
    assert data["subject"] == "club-a"
    assert data["current"] == {"jti": current["id"], "status": "active"}
    assert data["latest"]["jti"] == current["id"]
    assert other["id"] not in json.dumps(data)

    renewed = client.post(f"/api/authorizations/{current['id']}/renew", json={"expires_at": in_days(365)}).json()
    data = anonymous.post("/api/licenses/check", json={"project": "escfutboll", "jti": current["id"]}, headers=headers).json()
    assert data["latest"]["jti"] == renewed["id"]
    assert verify_token(data["latest"]["token"], data["keys"])["exp"] == renewed["expiresAt"]

    client.post(f"/api/authorizations/{renewed['id']}/revoke", json={"reason": "Falta de pago"})
    data = anonymous.post("/api/licenses/check", json={"project": "escfutboll", "jti": renewed["id"]}, headers=headers).json()
    assert data["current"]["status"] == "revoked"
    assert renewed["id"] in data["revoked"]
    assert data["latest"]["jti"] == current["id"]

    rotated = client.post(f"/api/license-clients/{credential.json()['id']}/rotate-secret").json()["apiKey"]
    assert anonymous.post("/api/licenses/check", json={"project": "escfutboll"}, headers=headers).status_code == 401
    new_headers = {"Authorization": f"Bearer {rotated}"}
    assert anonymous.post("/api/licenses/check", json={"project": "escfutboll"}, headers=new_headers).status_code == 200
    client.post(f"/api/license-clients/{credential.json()['id']}/revoke")
    assert anonymous.post("/api/licenses/check", json={"project": "escfutboll"}, headers=new_headers).status_code == 401
