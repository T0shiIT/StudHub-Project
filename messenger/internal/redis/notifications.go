package redisstore

import (
	"context"
	"encoding/json"
	"log"

	"github.com/redis/go-redis/v9"
)

// NotificationEvent — структура, которую Java публикует в Redis Pub/Sub.
type NotificationEvent struct {
	Type         string `json:"type"`
	Title        string `json:"title"`
	Body         string `json:"body"`
	TargetUserID int64  `json:"targetUserId"` // 0 == broadcast to all
	Link         string `json:"link"`
	Timestamp    int64  `json:"timestamp"`
}

// NotificationSender — интерфейс, через который notifications.go отправляет
// события конкретным пользователям.  Hub реализует этот интерфейс.
type NotificationSender interface {
	// SendToUser отправляет payload всем WebSocket-соединениям данного userId.
	SendToUser(userID int64, payload []byte)
	// Broadcast отправляет payload всем подключённым клиентам.
	Broadcast(payload []byte)
}

// SubscribeNotifications запускает горутину, которая слушает два паттерна:
//
//	notifications:user:*   — личные уведомления
//	notifications:all      — широковещательные уведомления
//
// Функцию нужно вызвать один раз из main после redisstore.Init().
func SubscribeNotifications(ctx context.Context, sender NotificationSender) {
	go subscribeUserNotifications(ctx, sender)
	go subscribeBroadcastNotifications(ctx, sender)
}

// subscribeUserNotifications подписывается на паттерн "notifications:user:*".
func subscribeUserNotifications(ctx context.Context, sender NotificationSender) {
	pubsub := rdb.PSubscribe(ctx, "notifications:user:*")
	defer pubsub.Close()

	log.Println("[notifications] subscribed to notifications:user:*")

	ch := pubsub.Channel()
	for {
		select {
		case <-ctx.Done():
			return
		case msg, ok := <-ch:
			if !ok {
				return
			}
			handleUserNotification(msg, sender)
		}
	}
}

// subscribeBroadcastNotifications подписывается на канал "notifications:all".
func subscribeBroadcastNotifications(ctx context.Context, sender NotificationSender) {
	pubsub := rdb.Subscribe(ctx, "notifications:all")
	defer pubsub.Close()

	log.Println("[notifications] subscribed to notifications:all")

	ch := pubsub.Channel()
	for {
		select {
		case <-ctx.Done():
			return
		case msg, ok := <-ch:
			if !ok {
				return
			}
			handleBroadcastNotification(msg, sender)
		}
	}
}

func handleUserNotification(msg *redis.Message, sender NotificationSender) {
	var event NotificationEvent
	if err := json.Unmarshal([]byte(msg.Payload), &event); err != nil {
		log.Printf("[notifications] failed to parse user event: %v", err)
		return
	}
	if event.TargetUserID == 0 {
		log.Printf("[notifications] user event has targetUserId=0, skipping")
		return
	}

	outbound := buildOutbound(event)
	log.Printf("[notifications] → user %d  type=%s", event.TargetUserID, event.Type)
	sender.SendToUser(event.TargetUserID, outbound)
}

func handleBroadcastNotification(msg *redis.Message, sender NotificationSender) {
	var event NotificationEvent
	if err := json.Unmarshal([]byte(msg.Payload), &event); err != nil {
		log.Printf("[notifications] failed to parse broadcast event: %v", err)
		return
	}

	outbound := buildOutbound(event)
	log.Printf("[notifications] → broadcast  type=%s", event.Type)
	sender.Broadcast(outbound)
}

// buildOutbound оборачивает событие в конверт { "kind": "notification", ... }
// чтобы фронтенд отличал уведомления от чат-сообщений.
func buildOutbound(event NotificationEvent) []byte {
	type outboundMsg struct {
		Kind      string `json:"kind"` // "notification"
		EventType string `json:"eventType"`
		Title     string `json:"title"`
		Body      string `json:"body"`
		Link      string `json:"link"`
		Timestamp int64  `json:"timestamp"`
	}
	out := outboundMsg{
		Kind:      "notification",
		EventType: event.Type,
		Title:     event.Title,
		Body:      event.Body,
		Link:      event.Link,
		Timestamp: event.Timestamp,
	}
	data, _ := json.Marshal(out)
	return data
}
