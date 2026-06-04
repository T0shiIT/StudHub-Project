package handlers

import (
	"context"
	"log"
	"messenger/internal/client"
	"messenger/internal/dm"
	redisstore "messenger/internal/redis"
	"messenger/internal/room"
	"strings"
	"time"

	"github.com/gorilla/websocket"
)

type savingClient struct {
	*client.Client
}

func newSavingClient(userID int64, login string, r *room.Room, conn *websocket.Conn) *savingClient {
	return &savingClient{
		Client: client.New(userID, login, r, conn),
	}
}

// savingRoom оборачивает room.Room: при Broadcast сохраняет сообщение в Redis
// и инкрементирует счётчики непрочитанных для всех участников DM-комнаты,
// кроме отправителя.
type savingRoom struct {
	*room.Room
}

func (sr *savingRoom) Broadcast(m room.Message) {
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()

		// 1. Сохранить сообщение в историю.
		if err := redisstore.SaveMessage(ctx, m); err != nil {
			log.Printf("[redis] save message error: %v", err)
		}

		// 2. Для DM-комнат инкрементировать счётчик непрочитанных получателя.
		if strings.HasPrefix(m.RoomID, "dm-") {
			idA, idB, ok := dm.ParseDMRoom(m.RoomID)
			if ok {
				// Получатель — тот участник, который НЕ является отправителем.
				recipientID := idB
				if m.SenderID == idB {
					recipientID = idA
				}
				if err := redisstore.IncrUnread(ctx, m.RoomID, recipientID); err != nil {
					log.Printf("[redis] incr unread error: %v", err)
				}
			}
		}
	}()

	sr.Room.Broadcast(m)
}

func (sc *savingClient) Run() {
	sc.Client.Run()
}
