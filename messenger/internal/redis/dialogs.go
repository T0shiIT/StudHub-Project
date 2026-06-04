package redisstore

import (
	"context"
	"fmt"
	"messenger/internal/room"
)

// ── DM room registry ─────────────────────────────────────────────────────────

// RegisterDMRoom добавляет roomID в Set участника.
// Ключ: "user:{userID}:dm_rooms"  (Redis Set)
func RegisterDMRoom(ctx context.Context, userID int64, roomID string) error {
	key := fmt.Sprintf("user:%d:dm_rooms", userID)
	if err := rdb.SAdd(ctx, key, roomID).Err(); err != nil {
		return fmt.Errorf("RegisterDMRoom user=%d room=%s: %w", userID, roomID, err)
	}
	return nil
}

// GetDMRoomsForUser возвращает все DM-комнаты пользователя.
func GetDMRoomsForUser(ctx context.Context, userID int64) ([]string, error) {
	key := fmt.Sprintf("user:%d:dm_rooms", userID)
	return rdb.SMembers(ctx, key).Result()
}

// ── Unread counter ────────────────────────────────────────────────────────────
//
// Вместо сканирования истории используем атомарный счётчик:
//   Ключ: "room:{roomID}:unread:{recipientID}"  (Redis integer)
//
// IncrUnread вызывается из saving_client при каждом новом сообщении
// для всех участников, кроме отправителя.
// ResetUnread вызывается при открытии чата (mark-as-read).

// IncrUnread атомарно увеличивает счётчик непрочитанных для получателя.
func IncrUnread(ctx context.Context, roomID string, recipientID int64) error {
	key := fmt.Sprintf("room:%s:unread:%d", roomID, recipientID)
	if err := rdb.Incr(ctx, key).Err(); err != nil {
		return fmt.Errorf("IncrUnread room=%s recipient=%d: %w", roomID, recipientID, err)
	}
	return nil
}

// ResetUnread обнуляет счётчик при прочтении.
func ResetUnread(ctx context.Context, roomID string, userID int64) error {
	key := fmt.Sprintf("room:%s:unread:%d", roomID, userID)
	if err := rdb.Del(ctx, key).Err(); err != nil {
		return fmt.Errorf("ResetUnread room=%s user=%d: %w", roomID, userID, err)
	}
	return nil
}

// GetUnread возвращает текущее значение счётчика (0 если ключа нет).
func GetUnread(ctx context.Context, roomID string, userID int64) int64 {
	key := fmt.Sprintf("room:%s:unread:%d", roomID, userID)
	val, err := rdb.Get(ctx, key).Int64()
	if err != nil {
		return 0
	}
	return val
}

// ── Last-read timestamp ───────────────────────────────────────────────────────
// Используется ws.go чтобы пометить сообщения прочитанными при подключении.

// SetLastRead сохраняет метку времени (ms) последнего прочитанного сообщения.
func SetLastRead(ctx context.Context, roomID string, userID int64, tsMs int64) error {
	key := fmt.Sprintf("room:%s:lastread:%d", roomID, userID)
	return rdb.Set(ctx, key, tsMs, 0).Err()
}

// ── Last message preview ──────────────────────────────────────────────────────

// LastMessageOf возвращает последнее сообщение в комнате (nil если пусто).
func LastMessageOf(ctx context.Context, roomID string) *room.Message {
	msgs, err := GetHistory(ctx, roomID, 1)
	if err != nil || len(msgs) == 0 {
		return nil
	}
	return &msgs[0]
}
