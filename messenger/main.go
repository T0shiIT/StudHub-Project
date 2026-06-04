package main

import (
	"context"
	"log"
	"messenger/handlers"
	"messenger/internal/hub"
	redisstore "messenger/internal/redis"
	"net/http"
	"os"
)

func main() {
	// Инициализируем Redis
	redisstore.Init()
	log.Println("[main] Redis connected")

	h := hub.New()

	// ── Запускаем подписку на Redis Pub/Sub для push-уведомлений ─────────────
	ctx := context.Background()
	redisstore.SubscribeNotifications(ctx, h)
	log.Println("[main] Notification subscriber started")
	// ─────────────────────────────────────────────────────────────────────────

	mux := http.NewServeMux()

	// WebSocket: GET /ws/{roomID}?token=...
	mux.HandleFunc("/ws/", handlers.WSHandler(h))

	// История комнаты: GET /history/{roomID}?token=...&limit=50
	mux.HandleFunc("/history/", handlers.HistoryHandler)

	// Healthcheck: GET /health
	mux.HandleFunc("/health", handlers.HealthHandler)

	port := os.Getenv("CHAT_PORT")
	if port == "" {
		port = "9000"
	}

	log.Printf("[main] chat service listening on :%s", port)
	if err := http.ListenAndServe(":"+port, mux); err != nil {
		log.Fatalf("[main] server error: %v", err)
	}
}
