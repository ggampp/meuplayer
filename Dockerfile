FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
COPY server.py cache_db.py ./
COPY public/ ./public/

RUN pip install --no-cache-dir -r requirements.txt

ENV PORT=8000
ENV MEUPLAYER_USER_DATA=/data

RUN mkdir -p /data

VOLUME ["/data"]

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:${PORT}/').read()" || exit 1

CMD ["python", "server.py"]
