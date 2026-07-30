# Native credential broker

This small Rust process is the operating-system credential boundary shared by
the desktop shell and local daemon. It speaks newline-delimited JSON over
stdin/stdout and stores opaque bytes in macOS Keychain, Windows Credential
Manager, or Linux Secret Service through the platform-native `keyring` backend.

Secrets are never accepted as command-line arguments or environment variables.
The JavaScript client sends them over a private child-process pipe and redacts
broker errors before structured logging. Headless environments use the separate
Argon2id + AES-256-GCM vault in `@marketingovo/credentials`.
