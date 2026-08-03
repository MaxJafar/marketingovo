package daemonlock

import (
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

func TestAcquireRejectsSecondProcessAndReleasesCleanly(t *testing.T) {
	root := t.TempDir()
	owner, err := Acquire(root)
	if err != nil {
		t.Fatalf("acquire first owner: %v", err)
	}

	if _, err := Acquire(root); !errors.Is(err, ErrAlreadyRunning) {
		_ = owner.Close()
		t.Fatalf("second in-process owner error = %v, want ErrAlreadyRunning", err)
	}
	if result := lockHelper(t, root); result != "unavailable" {
		_ = owner.Close()
		t.Fatalf("second process result = %q, want unavailable", result)
	}
	if err := owner.Close(); err != nil {
		t.Fatalf("release first owner: %v", err)
	}
	if err := owner.Close(); err != nil {
		t.Fatalf("repeat release: %v", err)
	}
	if result := lockHelper(t, root); result != "acquired" {
		t.Fatalf("owner after clean release = %q, want acquired", result)
	}

	info, err := os.Lstat(filepath.Join(root, filename))
	if err != nil || !info.Mode().IsRegular() || info.Mode()&os.ModeSymlink != 0 {
		t.Fatalf("persistent lock file = %v, %v", info, err)
	}
}

func TestAcquireRejectsSymlinkLockFile(t *testing.T) {
	root := t.TempDir()
	target := filepath.Join(t.TempDir(), "target")
	if err := os.WriteFile(target, []byte("target"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(target, filepath.Join(root, filename)); err != nil {
		t.Skipf("symlinks unavailable: %v", err)
	}
	if _, err := Acquire(root); err == nil {
		t.Fatal("symlinked ownership lock was accepted")
	}
}

func TestDaemonLockHelperProcess(t *testing.T) {
	if os.Getenv("MARKETINGOVO_LOCK_HELPER") != "1" {
		return
	}
	root := os.Getenv("MARKETINGOVO_LOCK_ROOT")
	lock, err := Acquire(root)
	if errors.Is(err, ErrAlreadyRunning) {
		fmt.Fprint(os.Stdout, "unavailable")
		os.Exit(0)
	}
	if err != nil {
		fmt.Fprintf(os.Stdout, "error:%v", err)
		os.Exit(0)
	}
	if err := lock.Close(); err != nil {
		fmt.Fprintf(os.Stdout, "error:%v", err)
		os.Exit(0)
	}
	fmt.Fprint(os.Stdout, "acquired")
	os.Exit(0)
}

func lockHelper(t *testing.T, root string) string {
	t.Helper()
	command := exec.Command(os.Args[0], "-test.run=^TestDaemonLockHelperProcess$")
	command.Env = append(os.Environ(), "MARKETINGOVO_LOCK_HELPER=1", "MARKETINGOVO_LOCK_ROOT="+root)
	output, err := command.CombinedOutput()
	if err != nil {
		t.Fatalf("run daemon lock helper: %v (%s)", err, output)
	}
	return strings.TrimSpace(string(output))
}
