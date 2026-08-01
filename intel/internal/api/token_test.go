package api

import (
	"os"
	"path/filepath"
	"runtime"
	"testing"
)

func TestLoadOrCreateTokenIsStableAndPrivate(t *testing.T) {
	path := filepath.Join(t.TempDir(), ServiceTokenFilename)
	first, err := LoadOrCreateToken(path, "")
	if err != nil {
		t.Fatal(err)
	}
	second, err := LoadOrCreateToken(path, "")
	if err != nil {
		t.Fatal(err)
	}
	if first != second || ValidateToken(first) != nil {
		t.Fatalf("token was not stable and valid: %q %q", first, second)
	}
	info, err := os.Stat(path)
	if err != nil {
		t.Fatal(err)
	}
	if runtime.GOOS != "windows" && info.Mode().Perm() != 0o600 {
		t.Fatalf("token mode = %o, want 0600", info.Mode().Perm())
	}
}

func TestBootstrapTokenIsNeverPersistedByServiceTokenHelper(t *testing.T) {
	path := filepath.Join(t.TempDir(), ServiceTokenFilename)
	service, err := LoadOrCreateToken(path, "")
	if err != nil {
		t.Fatal(err)
	}
	bootstrap, err := GenerateToken()
	if err != nil {
		t.Fatal(err)
	}
	if service == bootstrap {
		t.Fatal("independent 256-bit tokens unexpectedly matched")
	}
	payload, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if string(payload) != service+"\n" {
		t.Fatal("service token file does not contain only the persistent bearer token")
	}
}
