package auth

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"
)

type UserInfo struct {
	ID        int64  `json:"id"`
	Login     string `json:"login"`
	Email     string `json:"email"`
	Role      string `json:"role"`
	FirstName string `json:"firstName"`
	LastName  string `json:"lastName"`
	IsBlocked bool   `json:"is_blocked"`
}

var httpClient = &http.Client{Timeout: 5 * time.Second}

func javaBaseURL() string {
	u := os.Getenv("JAVA_BACKEND_URL")
	if u == "" {
		u = "http://backend:8080"
	}
	return strings.TrimRight(u, "/")
}

// ParseToken parses a simple "userID:login" token.
func ParseToken(tokenStr string) (int64, string, error) {
	parts := strings.SplitN(tokenStr, ":", 2)
	if len(parts) != 2 || parts[0] == "" || parts[1] == "" {
		return 0, "", fmt.Errorf("invalid token format")
	}
	id, err := strconv.ParseInt(parts[0], 10, 64)
	if err != nil {
		return 0, "", fmt.Errorf("invalid user id in token")
	}
	return id, parts[1], nil
}

func GetUser(email string) (*UserInfo, error) {
	url := fmt.Sprintf("%s/api/internal/user?email=%s", javaBaseURL(), email)
	resp, err := httpClient.Get(url)
	if err != nil {
		return nil, fmt.Errorf("java request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return nil, fmt.Errorf("user not found")
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("java returned %d", resp.StatusCode)
	}

	var u UserInfo
	if err := json.NewDecoder(resp.Body).Decode(&u); err != nil {
		return nil, fmt.Errorf("decode error: %w", err)
	}
	return &u, nil
}

func GetUserByID(userID int64) (*UserInfo, error) {
	url := fmt.Sprintf("%s/api/internal/user/%d", javaBaseURL(), userID)
	resp, err := httpClient.Get(url)
	if err != nil {
		return nil, fmt.Errorf("java request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return nil, fmt.Errorf("user not found")
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("java returned %d", resp.StatusCode)
	}

	var u UserInfo
	if err := json.NewDecoder(resp.Body).Decode(&u); err != nil {
		return nil, fmt.Errorf("decode error: %w", err)
	}
	return &u, nil
}
