// Package daemonlock provides exclusive ownership of a local daemon data
// root. The lock file is intentionally retained after release: deleting it
// creates a race in which two processes can lock different inodes.
package daemonlock

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sync"
)

const filename = ".agentinteld.lock"

// ErrAlreadyRunning means another daemon owns the same canonical data root.
var ErrAlreadyRunning = errors.New("daemon data root is already in use")

type Lock struct {
	file *os.File
	root string

	once     sync.Once
	closeErr error
}

var heldRoots = struct {
	sync.Mutex
	roots map[string]struct{}
}{roots: make(map[string]struct{})}

// Acquire obtains a non-blocking, OS-backed exclusive lock for dataRoot. The
// small in-process registry closes the same-process gap on platforms whose
// advisory-lock semantics are process scoped; the OS lock protects real
// daemon processes.
func Acquire(dataRoot string) (*Lock, error) {
	root, err := canonicalRoot(dataRoot)
	if err != nil {
		return nil, err
	}

	heldRoots.Lock()
	defer heldRoots.Unlock()
	if _, held := heldRoots.roots[root]; held {
		return nil, alreadyRunning(root)
	}

	path := filepath.Join(root, filename)
	file, err := os.OpenFile(path, os.O_CREATE|os.O_RDWR, 0o600)
	if err != nil {
		return nil, fmt.Errorf("open daemon ownership lock: %w", err)
	}
	if err := verifyLockFile(path, file); err != nil {
		_ = file.Close()
		return nil, err
	}
	if err := file.Chmod(0o600); err != nil {
		_ = file.Close()
		return nil, fmt.Errorf("harden daemon ownership lock: %w", err)
	}
	if err := acquireFileLock(file); err != nil {
		_ = file.Close()
		if errors.Is(err, ErrAlreadyRunning) {
			return nil, alreadyRunning(root)
		}
		return nil, fmt.Errorf("acquire daemon ownership lock: %w", err)
	}

	lock := &Lock{file: file, root: root}
	heldRoots.roots[root] = struct{}{}
	return lock, nil
}

// Close releases ownership. It is safe to call more than once.
func (lock *Lock) Close() error {
	if lock == nil {
		return nil
	}
	lock.once.Do(func() {
		unlockErr := releaseFileLock(lock.file)
		closeErr := lock.file.Close()
		heldRoots.Lock()
		delete(heldRoots.roots, lock.root)
		heldRoots.Unlock()
		lock.closeErr = errors.Join(unlockErr, closeErr)
	})
	return lock.closeErr
}

func canonicalRoot(dataRoot string) (string, error) {
	root, err := filepath.Abs(dataRoot)
	if err != nil {
		return "", fmt.Errorf("resolve daemon data root: %w", err)
	}
	root, err = filepath.EvalSymlinks(root)
	if err != nil {
		return "", fmt.Errorf("resolve daemon data root: %w", err)
	}
	info, err := os.Lstat(root)
	if err != nil || !info.IsDir() || info.Mode()&os.ModeSymlink != 0 {
		return "", fmt.Errorf("daemon data root must be a real non-symlink directory")
	}
	return root, nil
}

func verifyLockFile(path string, file *os.File) error {
	pathInfo, err := os.Lstat(path)
	if err != nil || !pathInfo.Mode().IsRegular() || pathInfo.Mode()&os.ModeSymlink != 0 {
		return fmt.Errorf("daemon ownership lock must be a regular non-symlink file")
	}
	openedInfo, err := file.Stat()
	if err != nil || !os.SameFile(pathInfo, openedInfo) {
		return fmt.Errorf("daemon ownership lock changed while opening")
	}
	return nil
}

func alreadyRunning(root string) error {
	return fmt.Errorf("%w: another agentinteld process owns %s", ErrAlreadyRunning, root)
}
