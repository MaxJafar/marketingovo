package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"github.com/GolemWorkers/golem-intel/internal/api"
	"github.com/GolemWorkers/golem-intel/internal/connectors"
	"github.com/GolemWorkers/golem-intel/internal/domain"
	"github.com/GolemWorkers/golem-intel/internal/jobs"
	"github.com/GolemWorkers/golem-intel/internal/policy"
	"github.com/GolemWorkers/golem-intel/internal/storage"
)

func main() {
	if err := run(os.Args[1:]); err != nil {
		fmt.Fprintln(os.Stderr, "golem-inteld:", err)
		os.Exit(1)
	}
}

func run(arguments []string) error {
	if len(arguments) == 1 && arguments[0] == "--version" {
		fmt.Println(domain.Version)
		return nil
	}
	if len(arguments) == 0 || arguments[0] != "serve" {
		return fmt.Errorf("usage: golem-inteld serve [flags]")
	}
	defaults, err := defaultPaths()
	if err != nil {
		return err
	}
	flags := flag.NewFlagSet("golem-inteld serve", flag.ContinueOnError)
	flags.SetOutput(os.Stderr)
	listen := flags.String("listen", "127.0.0.1:7465", "exact loopback listen address")
	dataDir := flags.String("data-dir", defaults.dataDir, "private durable data directory")
	pythonWorker := flags.String("python-worker", defaults.pythonWorker, "verified Python worker project directory")
	pythonCommand := flags.String("python-command", "", "sealed absolute Python interpreter (production)")
	uvCommand := flags.String("uv-command", "uv", "developer-only uv executable")
	bootstrapFromStdin := flags.Bool("dashboard-bootstrap-token-stdin", false, "read one bounded dashboard bootstrap token from stdin")
	dashboardDir := flags.String("dashboard-dir", defaults.dashboardDir, "built dashboard assets directory")
	fixturePath := flags.String("fixture", defaults.fixturePath, "competitive-pulse NDJSON fixture")
	concurrency := flags.Int("concurrency", 2, "maximum concurrent analysis jobs")
	if err := flags.Parse(arguments[1:]); err != nil {
		return err
	}
	if flags.NArg() != 0 {
		return fmt.Errorf("unexpected arguments: %v", flags.Args())
	}
	if err := policy.ValidateListenAddress(*listen); err != nil {
		return err
	}
	root, err := preparePrivateDirectory(*dataDir)
	if err != nil {
		return err
	}
	workerProject, err := verifyWorkerProject(*pythonWorker)
	if err != nil {
		return err
	}
	fixture, err := verifyRegularPath(*fixturePath, "fixture")
	if err != nil {
		return err
	}
	var pythonExecutable, uvExecutable string
	if *pythonCommand != "" {
		pythonExecutable, err = verifyAbsoluteExecutablePath(*pythonCommand, "python-command")
		if err != nil {
			return err
		}
	} else {
		uvExecutable, err = verifyExecutablePath(*uvCommand)
		if err != nil {
			return err
		}
	}
	dashboard := *dashboardDir
	if dashboard != "" {
		dashboard, _ = filepath.Abs(dashboard)
	}
	serviceToken, err := api.LoadOrCreateToken(filepath.Join(root, api.ServiceTokenFilename), "")
	if err != nil {
		return fmt.Errorf("prepare service token: %w", err)
	}
	var bootstrapToken string
	if *bootstrapFromStdin {
		bootstrapToken, err = readBootstrapToken(os.Stdin)
		closeErr := os.Stdin.Close()
		if err != nil {
			return fmt.Errorf("read dashboard bootstrap token from stdin: %w", err)
		}
		if closeErr != nil {
			return fmt.Errorf("close dashboard bootstrap stdin: %w", closeErr)
		}
	} else {
		bootstrapToken, err = api.GenerateToken()
		if err != nil {
			return fmt.Errorf("generate dashboard bootstrap ticket: %w", err)
		}
	}
	if bootstrapToken == serviceToken {
		return fmt.Errorf("dashboard bootstrap ticket must differ from the persistent service token")
	}
	store, err := storage.Open(filepath.Join(root, "golem-intel.sqlite3"))
	if err != nil {
		return err
	}
	defer store.Close()
	worker := &connectors.WorkerRunner{ProjectDir: workerProject, PythonCommand: pythonExecutable, UVCommand: uvExecutable}
	manager, err := jobs.New(jobs.Config{
		Store: store, DataRoot: root, FixturePath: fixture, Worker: worker, Concurrency: *concurrency,
	})
	if err != nil {
		return err
	}
	rootContext, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	if err := manager.Start(rootContext); err != nil {
		return err
	}
	defer manager.Close()
	localAPI, err := api.NewServer(api.ServerConfig{
		Store: store, Jobs: manager, DataRoot: root, ServiceToken: serviceToken,
		BootstrapToken: bootstrapToken, DashboardDir: dashboard,
	})
	if err != nil {
		return err
	}
	listener, err := net.Listen("tcp", *listen)
	if err != nil {
		return fmt.Errorf("listen: %w", err)
	}
	defer listener.Close()
	address, ok := listener.Addr().(*net.TCPAddr)
	if !ok || !address.IP.Equal(net.ParseIP("127.0.0.1")) {
		return fmt.Errorf("listener escaped the exact IPv4 loopback boundary")
	}
	httpServer := &http.Server{
		Handler: localAPI.Handler(), ReadHeaderTimeout: 5 * time.Second,
		IdleTimeout: 60 * time.Second, MaxHeaderBytes: 32 << 10,
	}
	serveResult := make(chan error, 1)
	go func() { serveResult <- httpServer.Serve(listener) }()
	// This is the one machine-readable startup line consumed by the desktop
	// shell. The token remains in the URL fragment and is never sent to HTTP.
	fmt.Printf("Dashboard: http://127.0.0.1:%d/#token=%s\n", address.Port, bootstrapToken)
	select {
	case <-rootContext.Done():
		shutdownContext, cancel := context.WithTimeout(context.Background(), 8*time.Second)
		defer cancel()
		if err := httpServer.Shutdown(shutdownContext); err != nil {
			return err
		}
		err := <-serveResult
		if err != nil && !errors.Is(err, http.ErrServerClosed) {
			return err
		}
		return nil
	case err := <-serveResult:
		if errors.Is(err, http.ErrServerClosed) {
			return nil
		}
		return err
	}
}

type pathDefaults struct {
	dataDir      string
	pythonWorker string
	dashboardDir string
	fixturePath  string
}

func defaultPaths() (pathDefaults, error) {
	dataDir, err := api.DefaultDataDir()
	if err != nil {
		return pathDefaults{}, err
	}
	workingDirectory, err := os.Getwd()
	if err != nil {
		return pathDefaults{}, err
	}
	return pathDefaults{
		dataDir: dataDir, pythonWorker: filepath.Join(workingDirectory, "workers", "intelligence"),
		dashboardDir: filepath.Join(workingDirectory, "apps", "dashboard", "dist"),
		fixturePath:  filepath.Join(workingDirectory, "fixtures", "competitive-pulse", "raw", "observations.ndjson"),
	}, nil
}

func preparePrivateDirectory(path string) (string, error) {
	absolute, err := filepath.Abs(path)
	if err != nil {
		return "", err
	}
	if err := os.MkdirAll(absolute, 0o700); err != nil {
		return "", fmt.Errorf("create data directory: %w", err)
	}
	info, err := os.Lstat(absolute)
	if err != nil || !info.IsDir() || info.Mode()&os.ModeSymlink != 0 {
		return "", fmt.Errorf("data directory must be a real non-symlink directory")
	}
	if err := os.Chmod(absolute, 0o700); err != nil {
		return "", err
	}
	return filepath.EvalSymlinks(absolute)
}

func verifyWorkerProject(path string) (string, error) {
	absolute, err := filepath.Abs(path)
	if err != nil {
		return "", err
	}
	info, err := os.Lstat(absolute)
	if err != nil || !info.IsDir() || info.Mode()&os.ModeSymlink != 0 {
		return "", fmt.Errorf("python-worker must be a real non-symlink project directory")
	}
	if _, err := verifyRegularPath(filepath.Join(absolute, "pyproject.toml"), "python worker pyproject"); err != nil {
		return "", err
	}
	return filepath.EvalSymlinks(absolute)
}

func verifyRegularPath(path, label string) (string, error) {
	absolute, err := filepath.Abs(path)
	if err != nil {
		return "", err
	}
	info, err := os.Lstat(absolute)
	if err != nil || !info.Mode().IsRegular() || info.Mode()&os.ModeSymlink != 0 {
		return "", fmt.Errorf("%s must be a regular non-symlink file", label)
	}
	return filepath.EvalSymlinks(absolute)
}

func verifyExecutablePath(path string) (string, error) {
	resolved := path
	if !filepath.IsAbs(resolved) {
		var err error
		resolved, err = exec.LookPath(resolved)
		if err != nil {
			return "", fmt.Errorf("resolve uv-command: %w", err)
		}
	}
	absolute, err := filepath.Abs(resolved)
	if err != nil {
		return "", err
	}
	info, err := os.Lstat(absolute)
	if err != nil || !info.Mode().IsRegular() || info.Mode()&os.ModeSymlink != 0 || info.Mode().Perm()&0o111 == 0 {
		return "", fmt.Errorf("uv-command must be an executable regular non-symlink file")
	}
	return filepath.EvalSymlinks(absolute)
}

func verifyAbsoluteExecutablePath(path, label string) (string, error) {
	if !filepath.IsAbs(path) {
		return "", fmt.Errorf("%s must be an absolute path", label)
	}
	absolute := filepath.Clean(path)
	info, err := os.Lstat(absolute)
	if err != nil || !info.Mode().IsRegular() || info.Mode()&os.ModeSymlink != 0 || info.Mode().Perm()&0o111 == 0 {
		return "", fmt.Errorf("%s must be an executable regular non-symlink file", label)
	}
	resolved, err := filepath.EvalSymlinks(absolute)
	if err != nil || resolved != absolute {
		return "", fmt.Errorf("%s path must not traverse symbolic links", label)
	}
	return absolute, nil
}

func readBootstrapToken(reader io.Reader) (string, error) {
	payload, err := io.ReadAll(io.LimitReader(reader, 65))
	if err != nil {
		return "", err
	}
	defer func() {
		for index := range payload {
			payload[index] = 0
		}
	}()
	if len(payload) > 64 {
		return "", fmt.Errorf("bootstrap token input exceeds 64 bytes")
	}
	if len(payload) == 44 && payload[43] == '\n' {
		payload = payload[:43]
	} else if len(payload) != 43 {
		return "", fmt.Errorf("bootstrap token input must contain exactly 43 bytes plus an optional LF")
	}
	token := string(payload)
	if err := api.ValidateToken(token); err != nil {
		return "", err
	}
	return token, nil
}
