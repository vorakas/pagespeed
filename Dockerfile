# Stage 1: Build React frontend
FROM node:20-alpine AS frontend-build
WORKDIR /build
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ .
RUN echo "cache-bust-2026-04-16" && npm run build

# Stage 2: Python application
FROM python:3.11-slim
WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt gunicorn

COPY . .
COPY --from=frontend-build /build/dist /app/frontend/dist

RUN mkdir -p /app/data

ENV FLASK_APP=app.py
ENV PYTHONUNBUFFERED=1

EXPOSE 5000

CMD gunicorn --workers 1 --threads 4 --timeout 300 --bind 0.0.0.0:$PORT app:app
