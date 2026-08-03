package main

import "testing"

func TestLegacyPlaintextTokenFlagIsRejected(t *testing.T) {
	if err := run([]string{"--token", "secret", "health"}); err == nil {
		t.Fatal("legacy plaintext token argv flag was accepted")
	}
}
