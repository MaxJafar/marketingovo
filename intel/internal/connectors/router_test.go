package connectors

import (
	"context"
	"testing"

	"github.com/MaxJafar/AGENTintel/internal/domain"
)

type stubWorker struct{ id string }

func (s *stubWorker) ID() string      { return s.id }
func (s *stubWorker) Available() bool { return true }
func (s *stubWorker) Analyze(context.Context, AnalysisRequest, ProgressSink) (domain.ConnectorResult, error) {
	return domain.ConnectorResult{WorkerVersion: s.id}, nil
}

func TestRouterSelectsBySourceShape(t *testing.T) {
	website := &stubWorker{id: "website"}
	fallback := &stubWorker{id: "fallback"}
	router := &SourceRouter{Website: website, Fallback: fallback}

	cases := []struct {
		name    string
		targets []string
		want    string
	}{
		{"live urls", []string{"https://a.example", "https://b.example"}, "website"},
		{"fixture ids", []string{"northstar-labs", "orbit-coffee"}, "fallback"},
		// A half-live comparison would produce targets that are not comparable,
		// and nothing downstream would say so, so it stays on one path.
		{"mixed", []string{"https://a.example", "orbit-coffee"}, "fallback"},
		{"empty", nil, "fallback"},
		{"not a url", []string{"ftp://a.example"}, "fallback"},
	}
	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			selected := router.Select(AnalysisRequest{TargetIDs: testCase.targets})
			if selected.ID() != testCase.want {
				t.Fatalf("routed to %s, expected %s", selected.ID(), testCase.want)
			}
		})
	}
}

// An imported dataset is already collected. Re-fetching it would contact sources
// the operator never asked to touch.
func TestImportedDatasetNeverRefetches(t *testing.T) {
	router := &SourceRouter{
		Website:  &stubWorker{id: "website"},
		Fallback: &stubWorker{id: "fallback"},
	}
	selected := router.Select(AnalysisRequest{
		TargetIDs:     []string{"https://a.example", "https://b.example"},
		ImportContext: &ImportContext{DatasetID: "dataset-1"},
	})
	if selected.ID() != "fallback" {
		t.Fatalf("an imported dataset must not be re-fetched, routed to %s", selected.ID())
	}
}

func TestWorkerForPassesThroughANonRouter(t *testing.T) {
	plain := &stubWorker{id: "plain"}
	if got := WorkerFor(plain, AnalysisRequest{}); got.ID() != "plain" {
		t.Fatalf("a non-router worker must be used as-is, got %s", got.ID())
	}
}
