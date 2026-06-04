package main

import (
	"log"
	"messenger/handlers"
	"messenger/internal/hub"
	redisstore "messenger/internal/redis"
	"net/http"
)

func main() {
	redisstore.Init()

	h := hub.New()

	mux := http.NewServeMux()

	// WebSocket – handles both group rooms and DM rooms (dm-{a}-{b}).
	mux.HandleFunc("/ws/", handlers.WSHandler(h))

	// REST
	mux.HandleFunc("/history/", handlers.HistoryHandler)
	mux.HandleFunc("/health", handlers.HealthHandler)

	// DM / Dialogs
	mux.HandleFunc("/api/dialogs", handlers.DialogsHandler)
	mux.HandleFunc("/api/dialogs/", handlers.MarkReadHandler) // POST /api/dialogs/{roomID}/read

	log.Println("[messenger] listening on :9000")
	if err := http.ListenAndServe(":9000", mux); err != nil {
		log.Fatal(err)
	}
}
