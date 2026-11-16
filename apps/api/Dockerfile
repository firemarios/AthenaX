# AthenaX API image — build context is the repo root (docker-compose.yml: apps/api/Dockerfile)
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# runtime code + assets (services are imported by app.services, catalog.yaml by the repos)
COPY apps/api ./apps/api
COPY services ./services
COPY packages ./packages
COPY data ./data
COPY infrastructure/database ./infrastructure/database

ENV PYTHONPATH=/app:/app/apps/api \
    ATHENAX_STORAGE_DIR=/app/storage

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--app-dir", "/app/apps/api"]
