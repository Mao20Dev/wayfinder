FROM node:22-alpine AS frontend
WORKDIR /build
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM python:3.13-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PORT=8000
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ backend/
COPY --from=frontend /build/dist frontend/dist/
# Build-time key only; runtime requires its own environment-provided secret.
RUN DJANGO_SECRET_KEY=build-only-placeholder-collectstatic python backend/manage.py collectstatic --noinput
RUN useradd --create-home app
USER app
EXPOSE 8000
CMD ["sh", "-c", "gunicorn --chdir backend config.wsgi:application --bind 0.0.0.0:$PORT --workers 1 --threads 6 --timeout 180 --access-logfile -"]
