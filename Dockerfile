FROM golang:1.26-alpine AS builder

WORKDIR /build

COPY go.mod go.sum ./
RUN go mod download

COPY . .

# Compila o binário de forma otimizada para Linux
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o meuplayer-server ./cmd/server

FROM alpine:3.19

WORKDIR /app

# Copia o binário e a pasta estática
COPY --from=builder /build/meuplayer-server .
COPY --from=builder /build/public/ ./public/

ENV PORT=3000
ENV MEUPLAYER_USER_DATA=/data
ENV MEUPLAYER_STATIC_DIR=/app/public

RUN mkdir -p /data

VOLUME ["/data"]

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s \
    CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT:-3000}/ || exit 1


CMD ["./meuplayer-server"]
