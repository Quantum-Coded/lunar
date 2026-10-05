# Backend image for Hugging Face Spaces (Docker SDK). Built from the folder produced by make_space_bundle.py.
FROM python:3.11-slim

RUN useradd -m -u 1000 app
WORKDIR /home/app

COPY --chown=app backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

COPY --chown=app backend backend
COPY --chown=app data data

USER app
WORKDIR /home/app/backend

ENV LUNAR_DATA_DIR=/home/app/data/processed \
    LUNAR_TRUST_PROXY=true \
    LUNAR_ENABLE_DOCS=false

# Hugging Face routes traffic to port 7860. Set LUNAR_CORS_ORIGINS as a Space variable (see docs/DEPLOYMENT.md).
EXPOSE 7860
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7860", "--proxy-headers", "--forwarded-allow-ips", "*"]
