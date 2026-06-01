package room

import (
	"encoding/json"
	"log"
	"sync"
)

// Message сообщение внутри комнаты.
type Message struct {
	RoomID   string `json:"room_id"`
	SenderID int64  `json:"sender_id"`
	Login    string `json:"login"`
	Text     string `json:"text"`
	SentAt   int64  `json:"sent_at"` // unix ms
}

// Client минимальный интерфейс, чтобы room не зависел от client-пакета напрямую.
type Client interface {
	Send(data []byte)
	UserID() int64
}

// Room управляет подписчиками и рассылает сообщения.
type Room struct {
	ID         string
	register   chan Client
	unregister chan Client
	broadcast  chan Message
	clients    map[Client]struct{}
	mu         sync.RWMutex
}

func New(id string) *Room {
	return &Room{
		ID:         id,
		register:   make(chan Client, 32),
		unregister: make(chan Client, 32),
		broadcast:  make(chan Message, 256),
		clients:    make(map[Client]struct{}),
	}
}

// Run запускается в отдельной горутине и живёт, пока есть хоть один клиент.
func (r *Room) Run() {
	for {
		select {
		case c := <-r.register:
			r.mu.Lock()
			r.clients[c] = struct{}{}
			r.mu.Unlock()
			log.Printf("[room %s] user %d joined (%d total)", r.ID, c.UserID(), r.count())

		case c := <-r.unregister:
			r.mu.Lock()
			delete(r.clients, c)
			r.mu.Unlock()
			log.Printf("[room %s] user %d left (%d total)", r.ID, c.UserID(), r.count())

		case msg := <-r.broadcast:
			data, err := json.Marshal(msg)
			if err != nil {
				log.Printf("[room %s] marshal error: %v", r.ID, err)
				continue
			}
			r.mu.RLock()
			for c := range r.clients {
				c.Send(data)
			}
			r.mu.RUnlock()
		}
	}
}

func (r *Room) Register(c Client)   { r.register <- c }
func (r *Room) Unregister(c Client) { r.unregister <- c }
func (r *Room) Broadcast(m Message) { r.broadcast <- m }

func (r *Room) count() int {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return len(r.clients)
}
