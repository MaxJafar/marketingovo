package connectors

// Per-run source selection.
//
// The daemon holds one Worker. Now that a live connector exists alongside the
// fixture path, the worker for a run depends on what the run actually asks for:
// URL-shaped targets are real sites and go to the website connector, everything
// else keeps the existing fixture/Python path unchanged.
//
// Selection is a pure function of the request. Nothing is stored between runs,
// so concurrent runs of different kinds cannot see each other's choice — which
// is why this is an interface the manager consults rather than state on a worker.

import (
	"context"
	"net/url"
	"strings"

	"github.com/MaxJafar/AGENTintel/internal/domain"
)

// Router picks the worker that should serve one analysis request.
type Router interface {
	Select(AnalysisRequest) Worker
}

// SourceRouter routes by target shape.
type SourceRouter struct {
	Website  Worker
	Fallback Worker
}

// IsLiveTarget reports whether a target names a real site rather than a fixture
// entity. Fixture targets are bare identifiers such as "northstar-labs"; live
// targets are absolute http(s) URLs.
func IsLiveTarget(target string) bool {
	parsed, err := url.Parse(strings.TrimSpace(target))
	if err != nil {
		return false
	}
	return (parsed.Scheme == "http" || parsed.Scheme == "https") && parsed.Host != ""
}

// Select routes a request whose targets are all live URLs to the website
// connector. A mixed set stays on the fallback: silently analysing half a
// comparison against live data and half against a fixture would produce a report
// whose targets are not comparable.
func (router *SourceRouter) Select(request AnalysisRequest) Worker {
	if router.Website == nil || len(request.TargetIDs) == 0 {
		return router.Fallback
	}
	if request.ImportContext != nil {
		// An imported dataset is already collected; it never re-fetches.
		return router.Fallback
	}
	for _, target := range request.TargetIDs {
		if !IsLiveTarget(target) {
			return router.Fallback
		}
	}
	return router.Website
}

// WorkerFor resolves the worker for a request, honouring a Router when the
// configured worker is one.
func WorkerFor(worker Worker, request AnalysisRequest) Worker {
	if router, ok := worker.(Router); ok {
		if selected := router.Select(request); selected != nil {
			return selected
		}
	}
	return worker
}

// The router is itself a Worker so the daemon can keep holding exactly one.
func (router *SourceRouter) ID() string {
	if router.Fallback != nil {
		return router.Fallback.ID()
	}
	return "source.router"
}

func (router *SourceRouter) Available() bool {
	return router.Fallback != nil && router.Fallback.Available()
}

func (router *SourceRouter) Analyze(ctx context.Context, request AnalysisRequest, emit ProgressSink) (domain.ConnectorResult, error) {
	return WorkerFor(router, request).Analyze(ctx, request, emit)
}
