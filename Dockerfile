# ── Frontend (Vite + TypeScript) ─────────────────────────────────────
FROM node:22-alpine AS frontend
WORKDIR /fe
COPY package.json package-lock.json ./
RUN npm ci
COPY vite.config.ts tsconfig.json ./
COPY src ./src
RUN npm run build:frontend

# ── Go server ────────────────────────────────────────────────────────
FROM golang:1.26-alpine AS builder
WORKDIR /build
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o meuplayer-server ./cmd/server

# ── Runtime ──────────────────────────────────────────────────────────
FROM alpine:3.19
WORKDIR /app

RUN apk add --no-cache wget ca-certificates

COPY --from=builder /build/meuplayer-server .
COPY --from=builder /build/public/ ./public/
# Overwrite with freshly built JS modules
COPY --from=frontend /fe/public/js/ ./public/js/

ENV PORT=3000
ENV MEUPLAYER_USER_DATA=/data
ENV MEUPLAYER_STATIC_DIR=/app/public

RUN mkdir -p /data

VOLUME ["/data"]
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s \
    CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT:-3000}/ || exit 1

CMD ["./meuplayer-server"]
