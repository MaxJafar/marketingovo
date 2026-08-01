//go:build aix || darwin || dragonfly || freebsd || linux || netbsd || openbsd || solaris

package daemonlock

import (
	"errors"
	"os"

	"golang.org/x/sys/unix"
)

func acquireFileLock(file *os.File) error {
	err := unix.Flock(int(file.Fd()), unix.LOCK_EX|unix.LOCK_NB)
	if errors.Is(err, unix.EAGAIN) || errors.Is(err, unix.EWOULDBLOCK) {
		return ErrAlreadyRunning
	}
	return err
}

func releaseFileLock(file *os.File) error {
	return unix.Flock(int(file.Fd()), unix.LOCK_UN)
}
