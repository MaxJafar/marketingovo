package main

import (
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/GolemWorkers/golem-intel/internal/api"
	"github.com/GolemWorkers/golem-intel/internal/domain"
)

func main() {
	if err := run(os.Args[1:]); err != nil {
		fmt.Fprintln(os.Stderr, "golem-intel:", err)
		os.Exit(1)
	}
}

func run(arguments []string) error {
	dataDir, err := api.DefaultDataDir()
	if err != nil {
		return err
	}
	global := flag.NewFlagSet("golem-intel", flag.ContinueOnError)
	global.SetOutput(os.Stderr)
	apiOrigin := global.String("api", "http://127.0.0.1:7465", "local daemon origin")
	tokenFile := global.String("token-file", filepath.Join(dataDir, api.ServiceTokenFilename), "service token file")
	if err := global.Parse(arguments); err != nil {
		return err
	}
	remaining := global.Args()
	if len(remaining) == 0 {
		return usageError()
	}
	command, commandArgs := remaining[0], remaining[1:]
	if command == "version" || command == "--version" {
		fmt.Println(domain.Version)
		return nil
	}
	var token string
	if command != "health" {
		token, err = api.ReadToken(*tokenFile)
		if err != nil {
			return fmt.Errorf("read service token: %w", err)
		}
	}
	client, err := api.NewClient(*apiOrigin, token, nil)
	if err != nil {
		return err
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	switch command {
	case "health":
		var response map[string]any
		if err := client.Do(ctx, http.MethodGet, "/v1/health", nil, &response); err != nil {
			return err
		}
		return printJSON(response)
	case "compare":
		return compareCommand(ctx, client, commandArgs)
	case "research":
		return researchCommand(ctx, client, commandArgs)
	case "runs":
		return runsCommand(ctx, client, commandArgs)
	case "run":
		return runCommand(ctx, client, commandArgs)
	case "watch":
		return watchCommand(ctx, client, commandArgs)
	case "cancel":
		return cancelCommand(ctx, client, commandArgs)
	case "replay":
		return replayCommand(ctx, client, commandArgs)
	case "report":
		return reportCommand(ctx, client, commandArgs)
	case "search":
		return searchCommand(ctx, client, commandArgs)
	case "entity":
		return entityCommand(ctx, client, commandArgs)
	case "monitoring":
		var response domain.MonitoringStatus
		if err := client.Do(ctx, http.MethodGet, "/v1/monitoring/status", nil, &response); err != nil {
			return err
		}
		return printJSON(response)
	default:
		return usageError()
	}
}

type stringList []string

func (values *stringList) String() string { return strings.Join(*values, ",") }
func (values *stringList) Set(value string) error {
	if strings.TrimSpace(value) == "" {
		return fmt.Errorf("value cannot be empty")
	}
	*values = append(*values, value)
	return nil
}

func compareCommand(ctx context.Context, client *api.Client, arguments []string) error {
	flags := flag.NewFlagSet("compare", flag.ContinueOnError)
	project := flags.String("project", "local", "project id")
	goal := flags.String("goal", "", "comparison goal")
	simulate := flags.String("simulate", "none", "failure simulation")
	wait := flags.Bool("wait", false, "wait for a terminal run")
	var targets, connectors stringList
	flags.Var(&targets, "target", "target id (repeatable)")
	flags.Var(&connectors, "connector", "connector id (repeatable)")
	if err := flags.Parse(arguments); err != nil {
		return err
	}
	if flags.NArg() != 0 {
		return fmt.Errorf("unexpected compare arguments: %v", flags.Args())
	}
	request := domain.ComparisonStartRequest{ProjectID: *project, TargetIDs: targets, ConnectorIDs: connectors, Goal: *goal, Simulate: *simulate}
	var run domain.Run
	if err := client.Do(ctx, http.MethodPost, "/v1/comparisons", request, &run); err != nil {
		return err
	}
	if *wait {
		return waitAndPrint(ctx, client, run.ID)
	}
	return printJSON(run)
}

func researchCommand(ctx context.Context, client *api.Client, arguments []string) error {
	flags := flag.NewFlagSet("research", flag.ContinueOnError)
	project := flags.String("project", "local", "project id")
	question := flags.String("question", "", "research question")
	budget := flags.Int("source-budget", 20, "source budget")
	wait := flags.Bool("wait", false, "wait for a terminal run")
	var targets stringList
	flags.Var(&targets, "target", "target id (repeatable)")
	if err := flags.Parse(arguments); err != nil {
		return err
	}
	if flags.NArg() != 0 {
		return fmt.Errorf("unexpected research arguments: %v", flags.Args())
	}
	request := domain.ResearchStartRequest{ProjectID: *project, Question: *question, TargetIDs: targets, SourceBudget: *budget}
	var run domain.Run
	if err := client.Do(ctx, http.MethodPost, "/v1/research", request, &run); err != nil {
		return err
	}
	if *wait {
		return waitAndPrint(ctx, client, run.ID)
	}
	return printJSON(run)
}

func runsCommand(ctx context.Context, client *api.Client, arguments []string) error {
	flags := flag.NewFlagSet("runs", flag.ContinueOnError)
	project := flags.String("project", "", "project id")
	limit := flags.Int("limit", 50, "maximum runs")
	if err := flags.Parse(arguments); err != nil {
		return err
	}
	query := url.Values{"limit": []string{strconv.Itoa(*limit)}}
	if *project != "" {
		query.Set("project_id", *project)
	}
	var response []domain.Run
	if err := client.Do(ctx, http.MethodGet, "/v1/runs?"+query.Encode(), nil, &response); err != nil {
		return err
	}
	return printJSON(response)
}

func runCommand(ctx context.Context, client *api.Client, arguments []string) error {
	if len(arguments) != 1 {
		return fmt.Errorf("usage: golem-intel run RUN_ID")
	}
	var response domain.RunDetail
	if err := client.Do(ctx, http.MethodGet, "/v1/runs/"+url.PathEscape(arguments[0]), nil, &response); err != nil {
		return err
	}
	return printJSON(response)
}

func watchCommand(ctx context.Context, client *api.Client, arguments []string) error {
	flags := flag.NewFlagSet("watch", flag.ContinueOnError)
	after := flags.Int64("after", 0, "last observed event sequence")
	if err := flags.Parse(arguments); err != nil {
		return err
	}
	if flags.NArg() != 1 {
		return fmt.Errorf("usage: golem-intel watch [--after N] RUN_ID")
	}
	return client.StreamEvents(ctx, flags.Arg(0), *after, func(event domain.RunEvent) error { return printJSON(event) })
}

func cancelCommand(ctx context.Context, client *api.Client, arguments []string) error {
	flags := flag.NewFlagSet("cancel", flag.ContinueOnError)
	reason := flags.String("reason", "", "cancellation reason")
	if err := flags.Parse(arguments); err != nil {
		return err
	}
	if flags.NArg() != 1 {
		return fmt.Errorf("usage: golem-intel cancel [--reason TEXT] RUN_ID")
	}
	var response domain.Run
	if err := client.Do(ctx, http.MethodPost, "/v1/runs/"+url.PathEscape(flags.Arg(0))+"/cancel", map[string]string{"reason": *reason}, &response); err != nil {
		return err
	}
	return printJSON(response)
}

func replayCommand(ctx context.Context, client *api.Client, arguments []string) error {
	if len(arguments) != 1 {
		return fmt.Errorf("usage: golem-intel replay RUN_ID")
	}
	var response domain.Run
	if err := client.Do(ctx, http.MethodPost, "/v1/runs/"+url.PathEscape(arguments[0])+"/replay", nil, &response); err != nil {
		return err
	}
	return printJSON(response)
}

func reportCommand(ctx context.Context, client *api.Client, arguments []string) error {
	if len(arguments) != 1 {
		return fmt.Errorf("usage: golem-intel report RUN_ID")
	}
	var response json.RawMessage
	if err := client.Do(ctx, http.MethodGet, "/v1/runs/"+url.PathEscape(arguments[0])+"/report", nil, &response); err != nil {
		return err
	}
	return printJSON(response)
}

func searchCommand(ctx context.Context, client *api.Client, arguments []string) error {
	flags := flag.NewFlagSet("search", flag.ContinueOnError)
	limit := flags.Int("limit", 20, "maximum results")
	if err := flags.Parse(arguments); err != nil {
		return err
	}
	if flags.NArg() != 1 {
		return fmt.Errorf("usage: golem-intel search [--limit N] QUERY")
	}
	query := url.Values{"q": []string{flags.Arg(0)}, "limit": []string{strconv.Itoa(*limit)}}
	var response []domain.SearchResult
	if err := client.Do(ctx, http.MethodGet, "/v1/search?"+query.Encode(), nil, &response); err != nil {
		return err
	}
	return printJSON(response)
}

func entityCommand(ctx context.Context, client *api.Client, arguments []string) error {
	if len(arguments) != 1 {
		return fmt.Errorf("usage: golem-intel entity ENTITY_ID")
	}
	var response domain.Entity
	if err := client.Do(ctx, http.MethodGet, "/v1/entities/"+url.PathEscape(arguments[0]), nil, &response); err != nil {
		return err
	}
	return printJSON(response)
}

func waitAndPrint(ctx context.Context, client *api.Client, runID string) error {
	ticker := time.NewTicker(150 * time.Millisecond)
	defer ticker.Stop()
	for {
		var detail domain.RunDetail
		if err := client.Do(ctx, http.MethodGet, "/v1/runs/"+url.PathEscape(runID), nil, &detail); err != nil {
			return err
		}
		if detail.Status.Terminal() {
			if err := printJSON(detail); err != nil {
				return err
			}
			if detail.Status == domain.RunFailed || detail.Status == domain.RunCancelled {
				return errors.New("run ended with status " + string(detail.Status))
			}
			return nil
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-ticker.C:
		}
	}
}

func printJSON(value any) error {
	encoder := json.NewEncoder(os.Stdout)
	encoder.SetIndent("", "  ")
	encoder.SetEscapeHTML(false)
	return encoder.Encode(value)
}

func usageError() error {
	return fmt.Errorf("usage: golem-intel [--api URL] [--token-file PATH] COMMAND; commands: health, compare, research, runs, run, watch, cancel, replay, report, search, entity, monitoring, version")
}
