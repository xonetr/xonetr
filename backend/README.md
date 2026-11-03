# Backend FastAPI de XONETR

Backend SQLite para autenticación, contenido publicado/borrador, versiones y medios.

## Instalar

Desde la raíz del proyecto, en PowerShell:

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -r backend/requirements.txt
Copy-Item backend/.env.example backend/.env
```

Cambia las credenciales y el secreto de `backend/.env`.

## Ejecutar

```powershell
cd backend
python -m uvicorn app:app --env-file .env --reload --port 8000
```

En otro terminal:

```powershell
Copy-Item .env.example .env.local
npm run dev
```

## Licencias de productos (escfutboll)

Las autorizaciones se firman con Ed25519. La clave privada **solo vive en este backend**, cifrada en la base
con `SIGNING_KEY_SECRET` (si falta, se usa `SESSION_SECRET`; en producción definí una propia). Las claves
guardadas en texto plano por versiones anteriores se cifran solas al arrancar.

Token: `base64url(JSON canónico de los claims).base64url(firma)`. Claims: `iss` (`xonetr`), `kid`, `jti`,
`project` (`escfutboll`), `sub` (ID del cliente), `scope` (módulos permitidos), `iat`, `exp` y `renews`.

| Acción | Endpoint (admin, cookie `admin_session`) |
|---|---|
| Emitir | `POST /api/authorizations` `{project, subject, scopes, expires_at}` |
| Renovar | `POST /api/authorizations/{id}/renew` `{expires_at, scopes?, revoke_previous?}` |
| Revocar | `POST /api/authorizations/{id}/revoke` `{reason?}` |
| Volver a ver el token | `GET /api/authorizations/{id}/token` |
| Listar | `GET /api/authorizations?project=&subject=` |
| Rotar clave de firma | `POST /api/authorization/keys/rotate` (las anteriores siguen verificando) |
| Revocar clave (comprometida) | `POST /api/authorization/keys/{kid}/revoke` (invalida lo que firmó) |
| Credencial de un backend de cliente | `POST /api/license-clients` `{project, subject, name}` → `apiKey` (se muestra una vez) |
| Rotar / revocar credencial | `POST /api/license-clients/{id}/rotate-secret`, `POST /api/license-clients/{id}/revoke` |

Públicos: `GET /api/authorization/public-keys` (todas las claves con su estado) y
`GET /api/authorizations/{id}/verify`.

Backend del cliente: `POST /api/licenses/check` con `Authorization: Bearer <apiKey>` y `{project, jti}`.
Responde el estado de su autorización actual, la última vigente (renovación), las revocadas y las claves
públicas. Cada credencial solo ve las autorizaciones de su cliente y producto.
