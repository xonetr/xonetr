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
