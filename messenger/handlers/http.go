package handlers

import (
	"context"
	"encoding/json"
	"messenger/internal/auth"
	redisstore "messenger/internal/redis"
	"net/http"
	"strconv"
	"strings"
)

func HistoryHandler(w http.ResponseWriter, r *http.Request) {
	roomID := strings.TrimPrefix(r.URL.Path, "/history/")
	if roomID == "" {
		http.Error(w, "room id required", http.StatusBadRequest)
		return
	}

	tokenStr := r.URL.Query().Get("token")
	if tokenStr == "" {
		tokenStr = strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
	}
	userID, _, err := auth.ParseToken(tokenStr)
	if err != nil || userID == 0 {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	limit := int64(50)
	if l := r.URL.Query().Get("limit"); l != "" {
		if n, err := strconv.ParseInt(l, 10, 64); err == nil && n > 0 && n <= 200 {
			limit = n
		}
	}

	msgs, err := redisstore.GetHistory(context.Background(), roomID, limit)
	if err != nil {
		http.Error(w, "redis error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(msgs)
}

func HealthHandler(w http.ResponseWriter, r *http.Request) {
	if err := redisstore.Client().Ping(context.Background()).Err(); err != nil {
		http.Error(w, "redis unavailable", http.StatusServiceUnavailable)
		return
	}
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte("ok"))
}
