package handlers

import (
	"context"
	"log"
	"messenger/internal/auth"
	"messenger/internal/dm"
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
		// TODO: заменить на проверку Origin в проде
		return true
	},
}

// WSHandler handles GET /ws/{roomID}
func WSHandler(h *hub.Hub) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		roomID := strings.TrimPrefix(r.URL.Path, "/ws/")
		if roomID == "" {
			http.Error(w, "room id required", http.StatusBadRequest)
			return
		}

		// Извлекаем токен: сначала query-param, потом Authorization header.
		tokenStr := r.URL.Query().Get("token")
		if tokenStr == "" {
			tokenStr = strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
		}
		if tokenStr == "" {
			http.Error(w, "token required", http.StatusUnauthorized)
			return
		}

		userID, login, err := auth.ParseToken(tokenStr)
		if err != nil {
			log.Printf("[ws] invalid token: %v", err)
			http.Error(w, "invalid token", http.StatusUnauthorized)
			return
		}
		log.Printf("[WS CONNECT] room=%s user=%d login=%s", roomID, userID, login)

		// ── DM-авторизация ────────────────────────────────────────────────────
		if strings.HasPrefix(roomID, "dm-") {
			if !dm.IsMember(roomID, userID) {
				log.Printf("[ws] user %d tried to access DM room %s — forbidden", userID, roomID)
				http.Error(w, "forbidden", http.StatusForbidden)
				return
			}

			idA, idB, _ := dm.ParseDMRoom(roomID)
			otherID := idB
			if userID == idB {
				otherID = idA
			}

			if _, err := auth.GetUserByID(otherID); err != nil {
				log.Printf("[ws] companion %d not found: %v", otherID, err)
				http.Error(w, "companion user not found", http.StatusNotFound)
				return
			}

			// Регистрируем комнату для обоих участников (идемпотентно).
			ctx := context.Background()
			if err := redisstore.RegisterDMRoom(ctx, idA, roomID); err != nil {
				log.Printf("[ws] RegisterDMRoom idA=%d: %v", idA, err)
			}
			if err := redisstore.RegisterDMRoom(ctx, idB, roomID); err != nil {
				log.Printf("[ws] RegisterDMRoom idB=%d: %v", idB, err)
			}
		}

		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			log.Printf("[ws] upgrade error: %v", err)
			return
		}

		ctx := context.Background()

		// Отправляем историю.
		history, err := redisstore.GetHistory(ctx, roomID, 50)
		if err != nil {
			log.Printf("[ws] history error: %v", err)
		} else {
			log.Printf("[ws] sending %d history messages to user %d in room %s",
				len(history), userID, roomID)
			sendHistory(conn, history)
		}

		// При подключении сбрасываем счётчик непрочитанных (пользователь видит сообщения).
		if strings.HasPrefix(roomID, "dm-") {
			if err := redisstore.ResetUnread(ctx, roomID, userID); err != nil {
				log.Printf("[ws] reset unread error: %v", err)
			}
			if last := redisstore.LastMessageOf(ctx, roomID); last != nil {
				if err := redisstore.SetLastRead(ctx, roomID, userID, last.SentAt); err != nil {
					log.Printf("[ws] set last read error: %v", err)
				}
			}
		}

		_ = redisstore.SetOnline(ctx, roomID, userID)

		rm := h.GetOrCreate(roomID)
		sc := newSavingClient(userID, login, rm, conn)
		sc.Run()

		_ = redisstore.SetOffline(context.Background(), roomID, userID)
	}
}

func sendHistory(conn *websocket.Conn, msgs []room.Message) {
	for i := len(msgs) - 1; i >= 0; i-- {
		_ = conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
		if err := conn.WriteJSON(msgs[i]); err != nil {
			return
		}
	}
}
