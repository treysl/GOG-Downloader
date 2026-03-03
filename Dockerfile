# Build frontend
FROM node:20-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/ ./
RUN npm install && npm run build

# Backend + serve frontend
FROM python:3.11-slim
WORKDIR /app

RUN pip install --no-cache-dir "fastapi>=0.104.0" "uvicorn[standard]>=0.24.0" "httpx>=0.25.0" "python-multipart>=0.0.6" "itsdangerous>=2.1.0"

COPY backend/ ./
COPY --from=frontend /app/frontend/dist ./../frontend/dist

ENV DOWNLOAD_PATH=/downloads
EXPOSE 8080

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
