package domain

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
)

func NewID(prefix string) (string, error) {
	var value [16]byte
	if _, err := rand.Read(value[:]); err != nil {
		return "", fmt.Errorf("generate identifier: %w", err)
	}
	return prefix + "_" + hex.EncodeToString(value[:]), nil
}
