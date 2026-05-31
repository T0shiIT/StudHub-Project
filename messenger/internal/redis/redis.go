package redisstore

import (
	"context"
	"encoding/json"
	"fmt"
	"messenger/internal/room"
	"os"
	"time"

	"github.com/redis/go-redis/v9"
)

const (
	maxMessagesPerRoom = 200 // сколько последних сообщений держим в Redis
	onlineTTL          = 90 * time.Second
)

var rdb *redis.Client

func Init() {
	addr := os.Getenv("REDIS_ADDR")
	if addr == "" {
		addr = "redis:6379"
	}
	rdb = redis.NewClient(&redis.Options{
		Addr: addr,
	})
}

func Client() *redis.Client { return rdb }

// SaveMessage кладёт сообщение в список room:{id}:messages (LPUSH + LTRIM).
func SaveMessage(ctx context.Context, msg room.Message) error {
	key := fmt.Sprintf("room:%s:messages", msg.RoomID)
	data, err := json.Marshal(msg)
	if err != nil {
		return err
	}
	pipe := rdb.Pipeline()
	pipe.LPush(ctx, key, data)
	pipe.LTrim(ctx, key, 0, int64(maxMessagesPerRoom-1))
	_, err = pipe.Exec(ctx)
	return err
}

// GetHistory возвращает последние limit сообщений комнаты (от новых к старым).
func GetHistory(ctx context.Context, roomID string, limit int64) ([]room.Message, error) {
	key := fmt.Sprintf("room:%s:messages", roomID)
	raw, err := rdb.LRange(ctx, key, 0, limit-1).Result()
	if err != nil {
		return nil, err
	}
	msgs := make([]room.Message, 0, len(raw))
	for _, s := range raw {
		var m room.Message
		if err := json.Unmarshal([]byte(s), &m); err == nil {
			msgs = append(msgs, m)
		}
	}
	return msgs, nil
}

// SetOnline отмечает юзера онлайн в данной комнате (TTL 90 сек).
func SetOnline(ctx context.Context, roomID string, userID int64) error {
	key := fmt.Sprintf("room:%s:online:%d", roomID, userID)
	return rdb.Set(ctx, key, 1, onlineTTL).Err()
}

// SetOffline удаляет ключ присутствия.
func SetOffline(ctx context.Context, roomID string, userID int64) error {
	key := fmt.Sprintf("room:%s:online:%d", roomID, userID)
	return rdb.Del(ctx, key).Err()
}
