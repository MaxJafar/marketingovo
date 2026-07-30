package policy

import (
	"errors"
	"fmt"
	"net"
	"slices"
	"strings"

	"github.com/GolemWorkers/agentintel/internal/domain"
)

var (
	ErrInvalidRequest    = errors.New("invalid request")
	ErrUnsupportedSource = errors.New("unsupported connector")
)

const FixtureConnectorID = "fixture.competitive-pulse"

func ValidateComparison(request domain.ComparisonStartRequest) error {
	if request.DatasetID != "" {
		return ValidateImportedComparison(request)
	}
	if err := boundedText("project_id", request.ProjectID, 1, 100); err != nil {
		return err
	}
	if err := uniqueTargets(request.TargetIDs, 2, 50); err != nil {
		return err
	}
	if len(request.Goal) > 1000 {
		return fmt.Errorf("%w: goal exceeds 1000 characters", ErrInvalidRequest)
	}
	connectors := request.ConnectorIDs
	if len(connectors) == 0 {
		connectors = []string{FixtureConnectorID}
	}
	if len(connectors) > 20 || hasDuplicate(connectors) {
		return fmt.Errorf("%w: connector_ids must contain at most 20 unique values", ErrInvalidRequest)
	}
	for _, connector := range connectors {
		if connector != FixtureConnectorID {
			return fmt.Errorf("%w: %s", ErrUnsupportedSource, connector)
		}
	}
	if !slices.Contains([]string{"", "none", "source_failure", "corrupt_artifact", "slow"}, request.Simulate) {
		return fmt.Errorf("%w: unsupported simulation", ErrInvalidRequest)
	}
	return nil
}

func ValidateImportedComparison(request domain.ComparisonStartRequest) error {
	if err := boundedText("project_id", request.ProjectID, 1, 100); err != nil {
		return err
	}
	if err := boundedText("dataset_id", request.DatasetID, 1, 200); err != nil {
		return err
	}
	if err := uniqueTargets(request.TargetIDs, 2, 5); err != nil {
		return err
	}
	if len(request.ConnectorIDs) != 0 || request.Simulate != "" && request.Simulate != "none" {
		return fmt.Errorf("%w: imported comparisons cannot carry connector_ids or simulation", ErrInvalidRequest)
	}
	if len(request.Goal) > 1000 {
		return fmt.Errorf("%w: goal exceeds 1000 characters", ErrInvalidRequest)
	}
	return nil
}

func NormalizeComparison(request domain.ComparisonStartRequest) domain.ComparisonStartRequest {
	if len(request.ConnectorIDs) == 0 {
		request.ConnectorIDs = []string{FixtureConnectorID}
	}
	if request.Simulate == "" {
		request.Simulate = "none"
	}
	return request
}

func ValidateResearch(request domain.ResearchStartRequest) error {
	if err := boundedText("project_id", request.ProjectID, 1, 100); err != nil {
		return err
	}
	if err := boundedText("question", request.Question, 3, 2000); err != nil {
		return err
	}
	if err := uniqueTargets(request.TargetIDs, 1, 50); err != nil {
		return err
	}
	if request.SourceBudget != 0 && (request.SourceBudget < 1 || request.SourceBudget > 100) {
		return fmt.Errorf("%w: source_budget must be between 1 and 100", ErrInvalidRequest)
	}
	return nil
}

func NormalizeResearch(request domain.ResearchStartRequest) domain.ResearchStartRequest {
	if request.SourceBudget == 0 {
		request.SourceBudget = 20
	}
	return request
}

func ValidateListenAddress(address string) error {
	host, port, err := net.SplitHostPort(address)
	if err != nil || port == "" {
		return fmt.Errorf("invalid listen address %q", address)
	}
	if host != "127.0.0.1" {
		return fmt.Errorf("listen address must use the exact loopback host 127.0.0.1")
	}
	return nil
}

func ValidateDataClass(value string) error {
	if slices.Contains([]string{"public", "first_party", "licensed_business_contact", "restricted"}, value) {
		return nil
	}
	return fmt.Errorf("%w: unsupported data class %q", ErrInvalidRequest, value)
}

func uniqueTargets(values []string, minimum, maximum int) error {
	if len(values) < minimum || len(values) > maximum {
		return fmt.Errorf("%w: target_ids must contain %d to %d values", ErrInvalidRequest, minimum, maximum)
	}
	if hasDuplicate(values) {
		return fmt.Errorf("%w: target_ids must be unique", ErrInvalidRequest)
	}
	for _, value := range values {
		if value != strings.TrimSpace(value) {
			return fmt.Errorf("%w: target_ids must not contain surrounding whitespace", ErrInvalidRequest)
		}
		if err := boundedText("target_id", value, 1, 100); err != nil {
			return err
		}
	}
	return nil
}

func boundedText(name, value string, minimum, maximum int) error {
	length := len([]rune(strings.TrimSpace(value)))
	if length < minimum || length > maximum {
		return fmt.Errorf("%w: %s must contain %d to %d characters", ErrInvalidRequest, name, minimum, maximum)
	}
	return nil
}

func hasDuplicate(values []string) bool {
	seen := make(map[string]struct{}, len(values))
	for _, value := range values {
		if _, exists := seen[value]; exists {
			return true
		}
		seen[value] = struct{}{}
	}
	return false
}
