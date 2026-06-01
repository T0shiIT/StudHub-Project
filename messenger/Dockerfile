FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.mod ./
RUN go mod tidy || true
COPY . .
RUN go mod tidy && CGO_ENABLED=0 GOOS=linux go build -o chat-service ./main.go

FROM alpine:3.19
RUN apk add --no-cache ca-certificates
WORKDIR /app
COPY --from=builder /app/chat-service .
EXPOSE 9000
HEALTHCHECK --interval=10s --timeout=5s --retries=3 CMD wget -qO- http://localhost:9000/health || exit 1
CMD ["./chat-service"]
