package handlers

import (
	"context"
	"encoding/json"
	"log"
	"messenger/internal/client"
	redisstore "messenger/internal/redis"
	"messenger/internal/room"
	"time"

	"github.com/gorilla/websocket"
)

// savingClient оборачивает client.Client и перехватывает Send,
// чтобы сохранять входящие сообщения в Redis.
// Сохранение происходит в readPump через кастомный broadcast.
type savingClient struct {
	*client.Client
}

func newSavingClient(userID int64, login string, r *room.Room, conn *websocket.Conn) *savingClient {
	return &savingClient{
		Client: client.New(userID, login, r, conn),
	}
}

// обёртка над room.Room, которая сохраняет в Redis при Broadcast.
type savingRoom struct {
	*room.Room
}

func (sr *savingRoom) Broadcast(m room.Message) {
	//Сохраняем в Redis асинхронно
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()
		if err := redisstore.SaveMessage(ctx, m); err != nil {
			log.Printf("[redis] save message error: %v", err)
		}
	}()
	sr.Room.Broadcast(m)
}

// incomingWrap читает WS и пишет в savingRoom
func (sc *savingClient) Run() {
	sc.Client.Run()
}

// parseAndSave хелпер для ручного сохранения если нужно из теста.
func parseAndSave(raw []byte, roomID string, userID int64, login string) {
	var inc struct {
		Text string `json:"text"`
	}
	if err := json.Unmarshal(raw, &inc); err != nil || inc.Text == "" {
		return
	}
	msg := room.Message{
		RoomID:   roomID,
		SenderID: userID,
		Login:    login,
		Text:     inc.Text,
		SentAt:   time.Now().UnixMilli(),
	}
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	_ = redisstore.SaveMessage(ctx, msg)
}
