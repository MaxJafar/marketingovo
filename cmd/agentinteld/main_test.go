package main

import (
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/GolemWorkers/agentintel/internal/api"
	"github.com/GolemWorkers/agentintel/internal/daemonlock"
)

func TestReadBootstrapTokenExactBoundedInput(t *testing.T) {
	token, err := api.GenerateToken()
	if err != nil {
		t.Fatal(err)
	}
	for _, input := range []string{token, token + "\n"} {
		got, err := readBootstrapToken(strings.NewReader(input))
		if err != nil || got != token {
			t.Fatalf("readBootstrapToken(%q) = %q, %v", input, got, err)
		}
	}
	for _, input := range []string{"", token + "\r\n", token + "x", strings.Repeat("!", 43), strings.Repeat("x", 65)} {
		if _, err := readBootstrapToken(strings.NewReader(input)); err == nil {
			t.Fatalf("readBootstrapToken accepted %q", input)
		}
	}
}

func TestVerifyAbsoluteExecutablePathRejectsRelativeAndSymlink(t *testing.T) {
	root, err := filepath.EvalSymlinks(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	executable := filepath.Join(root, "python")
	if err := os.WriteFile(executable, []byte("#! /bin/sh\n"), 0o700); err != nil {
		t.Fatal(err)
	}
	if got, err := verifyAbsoluteExecutablePath(executable, "python-command"); err != nil || got != executable {
		t.Fatalf("verified executable = %q, %v", got, err)
	}
	if _, err := verifyAbsoluteExecutablePath("python", "python-command"); err == nil {
		t.Fatal("relative executable was accepted")
	}
	link := filepath.Join(root, "python-link")
	if err := os.Symlink(executable, link); err != nil {
		t.Fatal(err)
	}
	if _, err := verifyAbsoluteExecutablePath(link, "python-command"); err == nil {
		t.Fatal("symlink executable was accepted")
	}
}

func TestLegacyBootstrapArgvFlagIsRejected(t *testing.T) {
	if err := run([]string{"serve", "--dashboard-bootstrap-token", "secret"}); err == nil {
		t.Fatal("legacy plaintext bootstrap argv flag was accepted")
	}
}

func TestDaemonRunRejectsAnOwnedDataRoot(t *testing.T) {
	root := t.TempDir()
	owner, err := daemonlock.Acquire(root)
	if err != nil {
		t.Fatal(err)
	}
	defer owner.Close()
	if err := run([]string{"serve", "--data-dir", root}); !errors.Is(err, daemonlock.ErrAlreadyRunning) {
		t.Fatalf("duplicate daemon root error = %v, want ErrAlreadyRunning", err)
	}
}
