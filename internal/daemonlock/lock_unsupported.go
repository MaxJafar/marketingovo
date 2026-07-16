//go:build !aix && !darwin && !dragonfly && !freebsd && !linux && !netbsd && !openbsd && !solaris && !windows

package daemonlock

import (
	"fmt"
	"os"
)

func acquireFileLock(_ *os.File) error {
	return fmt.Errorf("single-instance data-root ownership is unsupported on this platform")
}

func releaseFileLock(_ *os.File) error { return nil }
