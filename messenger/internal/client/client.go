package client

import (
	"encoding/json"
	"log"
	"messenger/internal/room"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

const (
	writeWait  = 10 * time.Second
	pongWait   = 60 * time.Second
	pingPeriod = 50 * time.Second
	maxMsgSize = 4096
)

// incomingMsg что присылает браузер.
type incomingMsg struct {
	Text string `json:"text"`
}

// Client представляет одно WS-соединение.
type Client struct {
	userID int64
	login  string
	room   *room.Room
	conn   *websocket.Conn
	send   chan []byte
	once   sync.Once
}

func New(userID int64, login string, r *room.Room, conn *websocket.Conn) *Client {
	return &Client{
		userID: userID,
		login:  login,
		room:   r,
		conn:   conn,
		send:   make(chan []byte, 128),
	}
}

// UserID реализует интерфейс room.Client.
func (c *Client) UserID() int64 { return c.userID }

// Send ставит сообщение в очередь на отправку (неблокирующий).
func (c *Client) Send(data []byte) {
	select {
	case c.send <- data:
	default:
		log.Printf("[client %d] send buffer full, dropping message", c.userID)
	}
}

// Run запускает читающую и пишущую горутины и блокируется до закрытия.
func (c *Client) Run() {
	c.room.Register(c)
	defer c.close()

	go c.writePump()
	c.readPump()
}

// readPump читает входящие сообщения от браузера.
func (c *Client) readPump() {
	c.conn.SetReadLimit(maxMsgSize)
	_ = c.conn.SetReadDeadline(time.Now().Add(pongWait))
	c.conn.SetPongHandler(func(string) error {
		return c.conn.SetReadDeadline(time.Now().Add(pongWait))
	})

	for {
		_, raw, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseNormalClosure) {
				log.Printf("[client %d] read error: %v", c.userID, err)
			}
			return
		}

		var inc incomingMsg
		if err := json.Unmarshal(raw, &inc); err != nil || inc.Text == "" {
			continue
		}

		c.room.Broadcast(room.Message{
			RoomID:   c.room.ID,
			SenderID: c.userID,
			Login:    c.login,
			Text:     inc.Text,
			SentAt:   time.Now().UnixMilli(),
		})
	}
}

// writePump отправляет сообщения из очереди и шлёт ping.
func (c *Client) writePump() {
	ticker := time.NewTicker(pingPeriod)
	defer ticker.Stop()

	for {
		select {
		case data, ok := <-c.send:
			_ = c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				_ = c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			if err := c.conn.WriteMessage(websocket.TextMessage, data); err != nil {
				log.Printf("[client %d] write error: %v", c.userID, err)
				return
			}

		case <-ticker.C:
			_ = c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

func (c *Client) close() {
	c.once.Do(func() {
		c.room.Unregister(c)
		c.conn.Close()
		close(c.send)
	})
}
