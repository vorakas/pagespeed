# Stage 1: Build React frontend
FROM node:20-slim AS frontend-build
WORKDIR /build
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

# Stage 2: Python application
FROM python:3.11-slim
WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt gunicorn

# Copy application code
COPY . .

# Copy frontend build output from stage 1
COPY --from=frontend-build /build/dist /app/frontend/dist

# Create directory for database
RUN mkdir -p /app/data

# Environment
ENV FLASK_APP=app.py
ENV PYTHONUNBUFFERED=1

EXPOSE 5000

CMD gunicorn --workers 1 --threads 4 --timeout 300 --bind 0.0.0.0:$PORT app:app
