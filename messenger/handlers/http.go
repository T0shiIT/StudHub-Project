package handlers

import (
	"context"
	"encoding/json"
	"log"
	"messenger/internal/auth"
	"messenger/internal/dm"
	redisstore "messenger/internal/redis"
	"net/http"
	"strconv"
	"strings"
)

// HistoryHandler handles GET /history/{roomID}
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

	if strings.HasPrefix(roomID, "dm-") && !dm.IsMember(roomID, userID) {
		http.Error(w, "forbidden", http.StatusForbidden)
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

// HealthHandler handles GET /health
func HealthHandler(w http.ResponseWriter, r *http.Request) {
	if err := redisstore.Client().Ping(context.Background()).Err(); err != nil {
		http.Error(w, "redis unavailable", http.StatusServiceUnavailable)
		return
	}
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte("ok"))
}

// DialogsHandler handles GET /api/dialogs?token={token}
func DialogsHandler(w http.ResponseWriter, r *http.Request) {
	tokenStr := r.URL.Query().Get("token")
	if tokenStr == "" {
		tokenStr = strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
	}
	userID, _, err := auth.ParseToken(tokenStr)
	if err != nil || userID == 0 {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	ctx := context.Background()
	roomIDs, err := redisstore.GetDMRoomsForUser(ctx, userID)
	if err != nil {
		http.Error(w, "redis error", http.StatusInternalServerError)
		return
	}

	type DialogDTO struct {
		RoomID            string `json:"roomId"`
		CompanionID       int64  `json:"companionId"`
		CompanionLogin    string `json:"companionLogin"`
		CompanionFullName string `json:"companionFullName"`
		LastMessage       string `json:"lastMessage"`
		LastMessageTime   int64  `json:"lastMessageTime"`
		UnreadCount       int64  `json:"unreadCount"`
	}

	result := make([]DialogDTO, 0, len(roomIDs))
	for _, roomID := range roomIDs {
		companionID, err := dm.CompanionID(roomID, userID)
		if err != nil {
			continue
		}

		companion, err := auth.GetUserByID(companionID)
		if err != nil {
			log.Printf("[dialogs] companion %d not found: %v", companionID, err)
			continue
		}

		// Собираем полное имя, избегая лишних пробелов если одно из полей пустое.
		fullName := strings.TrimSpace(companion.FirstName + " " + companion.LastName)
		if fullName == "" {
			fullName = companion.Login
		}

		lastMsg := redisstore.LastMessageOf(ctx, roomID)
		unread := redisstore.GetUnread(ctx, roomID, userID)

		d := DialogDTO{
			RoomID:            roomID,
			CompanionID:       companionID,
			CompanionLogin:    companion.Login,
			CompanionFullName: fullName,
			UnreadCount:       unread,
		}
		if lastMsg != nil {
			d.LastMessage = lastMsg.Text
			d.LastMessageTime = lastMsg.SentAt
		}
		result = append(result, d)
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(result)
}

// MarkReadHandler handles POST /api/dialogs/{roomID}/read?token={token}
func MarkReadHandler(w http.ResponseWriter, r *http.Request) {
	// Path: /api/dialogs/{roomID}/read
	trimmed := strings.TrimPrefix(r.URL.Path, "/api/dialogs/")
	roomID := strings.TrimSuffix(trimmed, "/read")
	if roomID == "" || roomID == trimmed {
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

	if !dm.IsMember(roomID, userID) {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}

	ctx := context.Background()

	// Сбрасываем атомарный счётчик непрочитанных.
	if err := redisstore.ResetUnread(ctx, roomID, userID); err != nil {
		log.Printf("[mark-read] reset unread error: %v", err)
	}

	// Обновляем метку последнего прочтения.
	if last := redisstore.LastMessageOf(ctx, roomID); last != nil {
		if err := redisstore.SetLastRead(ctx, roomID, userID, last.SentAt); err != nil {
			log.Printf("[mark-read] set last read error: %v", err)
		}
	}

	w.WriteHeader(http.StatusNoContent)
}
