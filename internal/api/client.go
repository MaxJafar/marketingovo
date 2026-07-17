package api

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/GolemWorkers/golem-intel/internal/domain"
)

type Client struct {
	baseURL    *url.URL
	token      string
	httpClient *http.Client
}

type ProblemError struct {
	Type     string `json:"type"`
	Title    string `json:"title"`
	Status   int    `json:"status"`
	Detail   string `json:"detail"`
	Instance string `json:"instance"`
	Code     string `json:"code"`
}

func (problem *ProblemError) Error() string {
	if problem.Detail != "" {
		return fmt.Sprintf("%s (%s)", problem.Detail, problem.Code)
	}
	return fmt.Sprintf("HTTP %d: %s", problem.Status, problem.Title)
}

func NewClient(baseURL, token string, httpClient *http.Client) (*Client, error) {
	parsed, err := url.Parse(strings.TrimRight(baseURL, "/"))
	if err != nil || parsed.Scheme != "http" || parsed.Hostname() != "127.0.0.1" || parsed.Port() == "" || parsed.Path != "" {
		return nil, fmt.Errorf("API URL must be an http://127.0.0.1:<port> origin")
	}
	if token != "" {
		if err := ValidateToken(token); err != nil {
			return nil, err
		}
	}
	if httpClient == nil {
		httpClient = &http.Client{Timeout: 30 * time.Second}
	}
	return &Client{baseURL: parsed, token: token, httpClient: httpClient}, nil
}

func (client *Client) Do(ctx context.Context, method, requestPath string, input, output any) error {
	var body io.Reader
	if input != nil {
		payload, err := json.Marshal(input)
		if err != nil {
			return err
		}
		body = bytes.NewReader(payload)
	}
	reference, err := url.Parse(requestPath)
	if err != nil || !strings.HasPrefix(reference.Path, "/v1/") {
		return fmt.Errorf("invalid API request path %q", requestPath)
	}
	endpoint := client.baseURL.ResolveReference(reference)
	request, err := http.NewRequestWithContext(ctx, method, endpoint.String(), body)
	if err != nil {
		return err
	}
	if input != nil {
		request.Header.Set("Content-Type", "application/json")
	}
	if requestPath != "/v1/health" {
		request.Header.Set("Authorization", "Bearer "+client.token)
	}
	response, err := client.httpClient.Do(request)
	if err != nil {
		return err
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return decodeProblem(response)
	}
	if output == nil {
		_, _ = io.Copy(io.Discard, io.LimitReader(response.Body, 1<<20))
		return nil
	}
	decoder := json.NewDecoder(io.LimitReader(response.Body, governanceResponseLimit))
	if err := decoder.Decode(output); err != nil {
		return fmt.Errorf("decode API response: %w", err)
	}
	return nil
}

// DoBytes submits caller-owned bytes without serializing a filename or local
// path into the request. It is used by the human-controlled CLI import action.
func (client *Client) DoBytes(ctx context.Context, method, requestPath, contentType string, body io.Reader, headers http.Header, output any) error {
	reference, err := url.Parse(requestPath)
	if err != nil || !strings.HasPrefix(reference.Path, "/v1/") {
		return fmt.Errorf("invalid API request path %q", requestPath)
	}
	endpoint := client.baseURL.ResolveReference(reference)
	request, err := http.NewRequestWithContext(ctx, method, endpoint.String(), body)
	if err != nil {
		return err
	}
	if contentType != "" {
		request.Header.Set("Content-Type", contentType)
	}
	for key, values := range headers {
		for _, value := range values {
			request.Header.Add(key, value)
		}
	}
	request.Header.Set("Authorization", "Bearer "+client.token)
	response, err := client.httpClient.Do(request)
	if err != nil {
		return err
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return decodeProblem(response)
	}
	if output == nil {
		_, _ = io.Copy(io.Discard, io.LimitReader(response.Body, 1<<20))
		return nil
	}
	if err := json.NewDecoder(io.LimitReader(response.Body, governanceResponseLimit)).Decode(output); err != nil {
		return fmt.Errorf("decode API response: %w", err)
	}
	return nil
}

const governanceResponseLimit = 128 << 20

func (client *Client) StreamEvents(ctx context.Context, runID string, after int64, consume func(domain.RunEvent) error) error {
	endpoint := *client.baseURL
	endpoint.Path = "/v1/runs/" + url.PathEscape(runID) + "/events"
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint.String(), nil)
	if err != nil {
		return err
	}
	request.Header.Set("Authorization", "Bearer "+client.token)
	if after > 0 {
		request.Header.Set("Last-Event-ID", strconv.FormatInt(after, 10))
	}
	streamClient := *client.httpClient
	streamClient.Timeout = 0
	response, err := streamClient.Do(request)
	if err != nil {
		return err
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return decodeProblem(response)
	}
	reader := bufio.NewReader(response.Body)
	var data []byte
	for {
		line, readErr := reader.ReadBytes('\n')
		if len(line) > 1 {
			trimmed := strings.TrimSpace(string(line))
			if strings.HasPrefix(trimmed, "data:") {
				data = append(data[:0], strings.TrimSpace(strings.TrimPrefix(trimmed, "data:"))...)
			}
		}
		if string(line) == "\n" || string(line) == "\r\n" {
			if len(data) > 0 {
				var event domain.RunEvent
				if err := json.Unmarshal(data, &event); err != nil {
					return fmt.Errorf("decode SSE event: %w", err)
				}
				if err := consume(event); err != nil {
					return err
				}
				data = nil
			}
		}
		if readErr != nil {
			if errors.Is(readErr, io.EOF) {
				return nil
			}
			return readErr
		}
	}
}

func decodeProblem(response *http.Response) error {
	var result ProblemError
	decoder := json.NewDecoder(io.LimitReader(response.Body, 1<<20))
	if err := decoder.Decode(&result); err != nil {
		return fmt.Errorf("HTTP %d: unreadable problem response", response.StatusCode)
	}
	if result.Status == 0 {
		result.Status = response.StatusCode
	}
	return &result
}
