package dm

import (
	"fmt"
	"strconv"
	"strings"
)

// ParseDMRoom parses a room ID like "dm-15-42" and returns (minID, maxID, ok).
func ParseDMRoom(roomID string) (int64, int64, bool) {
	if !strings.HasPrefix(roomID, "dm-") {
		return 0, 0, false
	}
	parts := strings.Split(strings.TrimPrefix(roomID, "dm-"), "-")
	if len(parts) != 2 {
		return 0, 0, false
	}
	a, err1 := strconv.ParseInt(parts[0], 10, 64)
	b, err2 := strconv.ParseInt(parts[1], 10, 64)
	if err1 != nil || err2 != nil {
		return 0, 0, false
	}
	return a, b, true
}

// RoomID returns the canonical DM room ID for two users.
func RoomID(userA, userB int64) string {
	if userA > userB {
		userA, userB = userB, userA
	}
	return fmt.Sprintf("dm-%d-%d", userA, userB)
}

// IsMember returns true if userID is one of the two participants.
func IsMember(roomID string, userID int64) bool {
	a, b, ok := ParseDMRoom(roomID)
	if !ok {
		return false
	}
	return userID == a || userID == b
}

// CompanionID returns the other participant's ID given the current user.
func CompanionID(roomID string, myID int64) (int64, error) {
	a, b, ok := ParseDMRoom(roomID)
	if !ok {
		return 0, fmt.Errorf("not a DM room: %s", roomID)
	}
	if myID == a {
		return b, nil
	}
	if myID == b {
		return a, nil
	}
	return 0, fmt.Errorf("user %d is not a member of %s", myID, roomID)
}
