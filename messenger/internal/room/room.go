package room

import "encoding/json"

// Message — чат-сообщение (существующая структура, не меняем).
type Message struct {
	RoomID   string `json:"room_id"`
	SenderID int64  `json:"sender_id"`
	Login    string `json:"login"`
	Text     string `json:"text"`
	SentAt   int64  `json:"sent_at"`
}

// Client — интерфейс одного WebSocket-соединения.
type Client interface {
	UserID() int64
	Send(data []byte)
}

// Room управляет набором подключённых клиентов.
type Room struct {
	ID         string
	register   chan Client
	unregister chan Client
	broadcast  chan Message
	rawBroadcast chan []byte       // ← NEW: произвольный payload (уведомления)
	clients    map[Client]struct{}
}

func New(id string) *Room {
	return &Room{
		ID:           id,
		register:     make(chan Client),
		unregister:   make(chan Client),
		broadcast:    make(chan Message, 64),
		rawBroadcast: make(chan []byte, 64),  // ← NEW
		clients:      make(map[Client]struct{}),
	}
}

func (r *Room) Register(c Client)   { r.register <- c }
func (r *Room) Unregister(c Client) { r.unregister <- c }

func (r *Room) Broadcast(msg Message) {
	r.broadcast <- msg
}

// BroadcastRaw рассылает сырой JSON всем клиентам в комнате (для уведомлений).
func (r *Room) BroadcastRaw(data []byte) {
	select {
	case r.rawBroadcast <- data:
	default:
	}
}

// SendToUser рассылает сырой JSON конкретному пользователю (по всем его соединениям в комнате).
func (r *Room) SendToUser(userID int64, data []byte) {
	// Запускаем через rawBroadcast с фильтром — чтобы не блокировать вызывающую горутину.
	// Простое решение: сразу итерируемся по клиентам из горутины Run через канал.
	r.rawBroadcast <- wrapTargeted(userID, data)
}

// wrapTargeted упаковывает данные вместе с целевым userID, чтобы Run мог отфильтровать.
func wrapTargeted(userID int64, data []byte) []byte {
	// Используем обёртку с полем __target, которую Run распакует.
	type targeted struct {
		Target  int64           `json:"__target"`
		Payload json.RawMessage `json:"__payload"`
	}
	out, _ := json.Marshal(targeted{Target: userID, Payload: data})
	return out
}

// Run — основной event loop комнаты.
func (r *Room) Run() {
	for {
		select {
		case c := <-r.register:
			r.clients[c] = struct{}{}

		case c := <-r.unregister:
			if _, ok := r.clients[c]; ok {
				delete(r.clients, c)
			}

		case msg := <-r.broadcast:
			data, _ := json.Marshal(msg)
			for c := range r.clients {
				c.Send(data)
			}

		case raw := <-r.rawBroadcast:
			// Проверяем, является ли это targeted-сообщением.
			type targeted struct {
				Target  int64           `json:"__target"`
				Payload json.RawMessage `json:"__payload"`
			}
			var t targeted
			if err := json.Unmarshal(raw, &t); err == nil && t.Target != 0 {
				// Личное уведомление — отправляем только нужному пользователю.
				for c := range r.clients {
					if c.UserID() == t.Target {
						c.Send(t.Payload)
					}
				}
			} else {
				// Широковещательное — всем.
				for c := range r.clients {
					c.Send(raw)
				}
			}
		}
	}
}
