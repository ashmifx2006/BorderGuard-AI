# BorderGuard AI — Deployment Package

## Recommended architecture

For a hackathon/demo deployment, run the React/Django web stack on a server and keep the YOLO/OpenCV worker on the machine that has access to the video source/GPU.

```text
Browser
  |
  v
React/Nginx  ---> Django/DRF ---> Database
                    ^
                    |
              AI worker (YOLO)
                    |
              CCTV / test.mp4
```

Do not expose the AI worker directly to the public internet. It should communicate with Django using a scoped service token over HTTPS/VPN/private networking in a production environment.

## Web deployment

1. Copy `backend/.env.example` to `backend/.env`.
2. Set `DEBUG=False`.
3. Generate a unique random `SECRET_KEY`.
4. Set real `ALLOWED_HOSTS` and `CSRF_TRUSTED_ORIGINS`.
5. Set `CORS_ALLOWED_ORIGINS` to the deployed frontend origin only.
6. Run migrations and `collectstatic`.
7. Serve Django with Gunicorn behind HTTPS.
8. Serve the React build with Nginx or a static hosting service.

## Docker

The repository includes a minimal `docker-compose.yml` for the web stack. It is intended as a deployment starting point, not a complete production infrastructure specification.

```bash
docker compose up --build
```

Before exposing it publicly, replace the local/demo `.env`, configure persistent database storage, HTTPS, backups, logging, and a managed database.

## AI worker deployment

Install `ai_engine/requirements.txt` on the machine connected to the video source. Configure:

```text
BORDERGUARD_API_BASE=https://<your-backend>/api
BORDERGUARD_API_TOKEN=<service-token>
```

Then run the approved source using the commands in `DEMO_MODE.md` or `run_project.md`.

## Database

SQLite remains the project's current database and is suitable for the college demo/prototype. For a multi-user production deployment, move to PostgreSQL using Django's standard database configuration rather than introducing a second persistence layer in application code.
