package handlers

import (
	"context"
	"log"
	"messenger/internal/auth"
	"messenger/internal/hub"
	redisstore "messenger/internal/redis"
	"messenger/internal/room"
	"net/http"
	"strings"
	"time"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		//!!!!!в проде заменить на проверку Origin
		return true
	},
}

// WSHandler обрабатывает GET /ws/{roomID}
// Ожидает JWT в query-параметре ?token=... или в заголовке Authorization: Bearer ...
func WSHandler(h *hub.Hub) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// 1. Достаём roomID из пути /ws/{roomID}
		roomID := strings.TrimPrefix(r.URL.Path, "/ws/")
		if roomID == "" {
			http.Error(w, "room id required", http.StatusBadRequest)
			return
		}

		//получаем jwt
		tokenStr := r.URL.Query().Get("token")
		if tokenStr == "" {
			bearer := r.Header.Get("Authorization")
			tokenStr = strings.TrimPrefix(bearer, "Bearer ")
		}
		if tokenStr == "" {
			http.Error(w, "token required", http.StatusUnauthorized)
			return
		}

		//парсим токен формата "userID:login"
		userID, login, err := auth.ParseToken(tokenStr)
		if err != nil {
			log.Printf("[ws] invalid token: %v", err)
			http.Error(w, "invalid token", http.StatusUnauthorized)
			return
		}

		//Проверяем что юзер не заблокирован через Java (опционально, по userID)
		// Для скорости пропускаем блокировку проверяем при выдаче chat-token на стороне Java
		_ = login

		// 5. Апгрейдим соединение до WebSocket
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			log.Printf("[ws] upgrade error: %v", err)
			return
		}

		//Отправляем историю сообщений из Redis
		ctx := context.Background()
		history, err := redisstore.GetHistory(ctx, roomID, 50)
		if err != nil {
			log.Printf("[ws] history error: %v", err)
		} else {
			sendHistory(conn, history)
		}

		//Отмечаем онлайн
		_ = redisstore.SetOnline(ctx, roomID, userID)

		//Регистрируем клиента в комнате
		rm := h.GetOrCreate(roomID)
		sc := newSavingClient(userID, login, rm, conn)
		sc.Run()

		// После отключения — снимаем онлайн
		_ = redisstore.SetOffline(context.Background(), roomID, userID)
	}
}

// sendHistory отправляет историю в обратном порядке (от старых к новым).
func sendHistory(conn *websocket.Conn, msgs []room.Message) {
	for i := len(msgs) - 1; i >= 0; i-- {
		_ = conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
		if err := conn.WriteJSON(msgs[i]); err != nil {
			return
		}
	}
}
