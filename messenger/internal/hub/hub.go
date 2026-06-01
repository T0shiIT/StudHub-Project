package hub

import (
	"messenger/internal/room"
	"sync"
)

// Hub хранит все активные комнаты и управляет их жизненным циклом.
type Hub struct {
	mu    sync.RWMutex
	rooms map[string]*room.Room
}

func New() *Hub {
	return &Hub{
		rooms: make(map[string]*room.Room),
	}
}

// GetOrCreate возвращает существующую комнату или создаёт новую.
func (h *Hub) GetOrCreate(roomID string) *room.Room {
	h.mu.Lock()
	defer h.mu.Unlock()

	r, ok := h.rooms[roomID]
	if !ok {
		r = room.New(roomID)
		go r.Run()
		h.rooms[roomID] = r
	}
	return r
}

// Remove удаляет пустую комнату из хаба.
func (h *Hub) Remove(roomID string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	delete(h.rooms, roomID)
}
