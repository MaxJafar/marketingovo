package policy

import (
	"testing"

	"github.com/GolemWorkers/agentintel/internal/domain"
)

func TestComparisonPolicy(t *testing.T) {
	valid := domain.ComparisonStartRequest{ProjectID: "demo", TargetIDs: []string{"northstar-labs", "orbit-coffee"}}
	if err := ValidateComparison(valid); err != nil {
		t.Fatalf("valid comparison rejected: %v", err)
	}
	duplicate := valid
	duplicate.TargetIDs = []string{"northstar-labs", "northstar-labs"}
	if err := ValidateComparison(duplicate); err == nil {
		t.Fatal("duplicate target IDs accepted")
	}
	whitespace := valid
	whitespace.TargetIDs = []string{" northstar-labs", "orbit-coffee"}
	if err := ValidateComparison(whitespace); err == nil {
		t.Fatal("target ID with surrounding whitespace was accepted")
	}
	unsupported := valid
	unsupported.ConnectorIDs = []string{"scrape.private-session"}
	if err := ValidateComparison(unsupported); err == nil {
		t.Fatal("unsupported connector accepted")
	}
}

func TestResearchAndListenPolicies(t *testing.T) {
	if err := ValidateResearch(domain.ResearchStartRequest{
		ProjectID: "demo", Question: "Who is growing?", TargetIDs: []string{"northstar-labs"},
	}); err != nil {
		t.Fatalf("valid research rejected: %v", err)
	}
	if err := ValidateListenAddress("127.0.0.1:7465"); err != nil {
		t.Fatalf("loopback rejected: %v", err)
	}
	for _, address := range []string{"0.0.0.0:7465", "localhost:7465", ":7465"} {
		if err := ValidateListenAddress(address); err == nil {
			t.Fatalf("unsafe address %q accepted", address)
		}
	}
}
