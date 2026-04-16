# NOTE: Docker support is no longer the primary distribution method.
# Use the portable Windows build instead — see README for instructions.

# Build frontend
FROM node:22-alpine3.22 AS frontend
WORKDIR /app/frontend
COPY frontend/ ./
RUN npm ci && npm run build

# Backend + serve frontend
FROM python:3.12-slim-bookworm
WORKDIR /app

RUN pip install --no-cache-dir "fastapi>=0.104.0" "uvicorn[standard]>=0.24.0" "httpx>=0.25.0" "python-multipart>=0.0.6" "itsdangerous>=2.1.0"

COPY backend/ ./
COPY --from=frontend /app/frontend/dist ./../frontend/dist

ENV DOWNLOAD_PATH=/downloads
EXPOSE 8080

RUN useradd --create-home --shell /usr/sbin/nologin appuser && chown -R appuser:appuser /app
USER appuser

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
