package api

import (
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strings"
)

const ServiceTokenFilename = "service-token"

func GenerateToken() (string, error) {
	buffer := make([]byte, 32)
	if _, err := rand.Read(buffer); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(buffer), nil
}

func ValidateToken(token string) error {
	if len(token) != 43 {
		return fmt.Errorf("service token must be a 43-character base64url value")
	}
	decoded, err := base64.RawURLEncoding.DecodeString(token)
	if err != nil || len(decoded) != 32 {
		return fmt.Errorf("service token must be a 43-character base64url value")
	}
	return nil
}

func LoadOrCreateToken(path, provided string) (string, error) {
	if path == "" {
		return "", fmt.Errorf("service token path is required")
	}
	if provided != "" {
		if err := ValidateToken(provided); err != nil {
			return "", err
		}
		if err := writePrivateAtomic(path, []byte(provided+"\n")); err != nil {
			return "", err
		}
		return provided, nil
	}
	payload, err := readPrivateToken(path)
	if err == nil {
		return payload, nil
	}
	if !errors.Is(err, os.ErrNotExist) {
		return "", err
	}
	token, err := GenerateToken()
	if err != nil {
		return "", err
	}
	if err := writePrivateAtomic(path, []byte(token+"\n")); err != nil {
		return "", err
	}
	return token, nil
}

func ReadToken(path string) (string, error) { return readPrivateToken(path) }

func readPrivateToken(path string) (string, error) {
	info, err := os.Lstat(path)
	if err != nil {
		return "", err
	}
	if !info.Mode().IsRegular() || info.Mode()&os.ModeSymlink != 0 {
		return "", fmt.Errorf("service token must be a regular non-symlink file")
	}
	if runtime.GOOS != "windows" && info.Mode().Perm()&0o077 != 0 {
		return "", fmt.Errorf("service token permissions are too broad; expected 0600")
	}
	payload, err := os.ReadFile(path)
	if err != nil {
		return "", err
	}
	token := strings.TrimSpace(string(payload))
	if err := ValidateToken(token); err != nil {
		return "", err
	}
	return token, nil
}

func writePrivateAtomic(path string, payload []byte) (err error) {
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return err
	}
	temporary, err := os.CreateTemp(filepath.Dir(path), ".service-token-*")
	if err != nil {
		return err
	}
	temporaryPath := temporary.Name()
	defer func() {
		_ = temporary.Close()
		if err != nil {
			_ = os.Remove(temporaryPath)
		}
	}()
	if err = temporary.Chmod(0o600); err != nil {
		return err
	}
	if _, err = temporary.Write(payload); err != nil {
		return err
	}
	if err = temporary.Sync(); err != nil {
		return err
	}
	if err = temporary.Close(); err != nil {
		return err
	}
	if err = os.Rename(temporaryPath, path); err != nil {
		return err
	}
	return os.Chmod(path, 0o600)
}

func DefaultDataDir() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	switch runtime.GOOS {
	case "darwin":
		return filepath.Join(home, "Library", "Application Support", "Golem Intel"), nil
	case "windows":
		root := os.Getenv("LOCALAPPDATA")
		if root == "" {
			return "", fmt.Errorf("LOCALAPPDATA is not set")
		}
		return filepath.Join(root, "Golem Intel"), nil
	default:
		root := os.Getenv("XDG_DATA_HOME")
		if root == "" {
			root = filepath.Join(home, ".local", "share")
		}
		return filepath.Join(root, "golem-intel"), nil
	}
}
