package policy

// Outbound network policy for every connector that reaches a live source.
//
// The daemon owns networking, not the connectors, so this is the single place
// where an outbound request is allowed or refused. A connector that builds its
// own http.Client bypasses every control here and must not exist.
//
// The controls are deliberately fail-closed: anything not explicitly permitted
// is refused, including on each hop of a redirect chain. A public-web research
// tool is a natural SSRF vehicle — it fetches attacker-influenced URLs by
// design — so the loopback API, cloud metadata endpoints and private address
// space have to be unreachable even when a redirect points at them.

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

// EgressLimits bounds a single connector's outbound behaviour.
type EgressLimits struct {
	MaxRedirects    int
	MaxResponseSize int64
	RequestTimeout  time.Duration
	TotalTimeout    time.Duration
	MaxConcurrency  int
	MinRequestGap   time.Duration
	UserAgent       string
	// AllowPrivateHosts is an explicit, per-project operator decision. It stays
	// false unless a human turned it on for a known internal host, and it never
	// relaxes the metadata-endpoint or non-HTTP-scheme rules.
	AllowPrivateHosts bool
	// AllowLoopback exists so tests can drive the real transport against a
	// local httptest server. It defaults to false, is never set from product
	// code, and still does not relax the metadata-endpoint rule. Nothing that
	// ships may set it: TestDefaultLimitsRefuseLoopback pins the default, and
	// the connector never exposes it as an option.
	AllowLoopback bool
}

// DefaultEgressLimits are the bounds used when a connector does not override
// them. They are intentionally conservative.
func DefaultEgressLimits(userAgent string) EgressLimits {
	return EgressLimits{
		MaxRedirects:    5,
		MaxResponseSize: 5 << 20, // 5 MiB
		RequestTimeout:  15 * time.Second,
		TotalTimeout:    5 * time.Minute,
		MaxConcurrency:  4,
		MinRequestGap:   250 * time.Millisecond,
		UserAgent:       userAgent,
	}
}

// EgressError explains why a request was refused. The reason is a stable code so
// a run can report a blocked fetch as a policy decision rather than a failure.
type EgressError struct {
	Reason string
	Detail string
}

func (e *EgressError) Error() string {
	return fmt.Sprintf("%s: %s", e.Reason, e.Detail)
}

var errNoAddresses = errors.New("host resolved to no usable address")

// Hostnames that always mean "this machine" or "this VM's credential service".
// Blocking them by name gives a precise refusal and avoids a pointless lookup;
// the address checks below still cover anything that slips past.
var blockedHostnames = map[string]struct{}{
	"localhost":                {},
	"ip6-localhost":            {},
	"ip6-loopback":             {},
	"metadata":                 {},
	"metadata.google.internal": {},
	"instance-data":            {},
}

// Cloud instance-metadata endpoints. These are plain public-looking addresses
// that return credentials from inside a VM, so they are refused by address
// regardless of whether private hosts are otherwise allowed.
var metadataAddresses = map[string]struct{}{
	"169.254.169.254": {},
	"fd00:ec2::254":   {},
	"100.100.100.200": {},
}

// Well-known non-HTTP service ports. Speaking HTTP at these is almost always an
// attempt to reach something that is not a website.
var blockedPorts = map[string]struct{}{
	"22": {}, "23": {}, "25": {}, "110": {}, "143": {}, "445": {},
	"465": {}, "587": {}, "993": {}, "995": {}, "1433": {}, "1521": {},
	"3306": {}, "3389": {}, "5432": {}, "5984": {}, "6379": {}, "7001": {},
	"8020": {}, "9042": {}, "9200": {}, "9300": {}, "11211": {}, "27017": {},
}

// ValidateEgressURL applies every scheme, host and shape rule to one URL. It
// does not resolve DNS; ValidateResolvedAddress covers that at dial time, which
// is what closes the rebinding window.
func ValidateEgressURL(raw string, limits EgressLimits) (*url.URL, error) {
	parsed, err := url.Parse(strings.TrimSpace(raw))
	if err != nil {
		return nil, &EgressError{Reason: "malformed_url", Detail: err.Error()}
	}
	switch parsed.Scheme {
	case "http", "https":
	default:
		return nil, &EgressError{
			Reason: "scheme_not_allowed",
			Detail: fmt.Sprintf("%q is not http or https", parsed.Scheme),
		}
	}
	if parsed.Host == "" {
		return nil, &EgressError{Reason: "missing_host", Detail: raw}
	}
	if parsed.User != nil {
		// Credentials in a URL would be sent to whatever the host resolves to,
		// and would end up in stored evidence.
		return nil, &EgressError{
			Reason: "userinfo_not_allowed",
			Detail: "credentials must not travel in a source URL",
		}
	}
	host := parsed.Hostname()
	if host == "" {
		return nil, &EgressError{Reason: "missing_host", Detail: raw}
	}
	lowered := strings.ToLower(strings.TrimSuffix(host, "."))
	if _, blocked := blockedHostnames[lowered]; blocked {
		return nil, &EgressError{Reason: "loopback_blocked", Detail: lowered}
	}
	if strings.HasSuffix(lowered, ".localhost") {
		return nil, &EgressError{Reason: "loopback_blocked", Detail: lowered}
	}
	// A bare IP literal skips DNS, so it is checked here as well as at dial time.
	// parseIPLiteral also expands the numeric shorthands (127.1, 0x7f.1, 2130706433)
	// that resolvers accept but net.ParseIP rejects — a long-standing way to smuggle
	// a loopback address past a naive check.
	if ip := parseIPLiteral(host); ip != nil {
		if err := validateIP(ip, limits); err != nil {
			return nil, err
		}
	}
	// Ports are a blocklist, not an allowlist. An allowlist of the four common
	// HTTP ports would refuse legitimate feeds served on 8000 or 3000, while the
	// loopback and private-space rules above already prevent reaching an internal
	// service. What remains worth refusing outright is the set of well-known
	// non-HTTP services an SSRF payload actually targets.
	if port := parsed.Port(); port != "" {
		if _, blocked := blockedPorts[port]; blocked {
			return nil, &EgressError{
				Reason: "port_not_allowed",
				Detail: fmt.Sprintf("port %s is a well-known non-HTTP service", port),
			}
		}
	}
	return parsed, nil
}

// parseIPLiteral accepts every numeric form a resolver would, not only the
// canonical dotted quad: "127.0.0.1", "127.1", "0x7f.0.0.1", "2130706433".
func parseIPLiteral(host string) net.IP {
	if ip := net.ParseIP(host); ip != nil {
		return ip
	}
	parts := strings.Split(host, ".")
	if len(parts) == 0 || len(parts) > 4 {
		return nil
	}
	values := make([]uint64, 0, len(parts))
	for _, part := range parts {
		if part == "" {
			return nil
		}
		base := 10
		text := part
		switch {
		case strings.HasPrefix(strings.ToLower(part), "0x"):
			base, text = 16, part[2:]
		case len(part) > 1 && part[0] == '0':
			base, text = 8, part[1:]
		}
		if text == "" {
			return nil
		}
		value, err := strconv.ParseUint(text, base, 64)
		if err != nil {
			return nil
		}
		values = append(values, value)
	}
	// The final part absorbs the remaining bytes: a.b.c.d, a.b.c, a.b, or a.
	var packed uint64
	last := values[len(values)-1]
	leading := values[:len(values)-1]
	remaining := 4 - len(leading)
	if remaining < 1 || last >= 1<<(8*remaining) {
		return nil
	}
	for _, value := range leading {
		if value > 0xff {
			return nil
		}
		packed = packed<<8 | value
	}
	packed = packed<<(8*remaining) | last
	if packed > 0xffffffff {
		return nil
	}
	return net.IPv4(
		byte(packed>>24), byte(packed>>16), byte(packed>>8), byte(packed),
	)
}

func validateIP(ip net.IP, limits EgressLimits) error {
	if _, blocked := metadataAddresses[ip.String()]; blocked {
		return &EgressError{
			Reason: "metadata_endpoint_blocked",
			Detail: ip.String(),
		}
	}
	if ip.IsLoopback() && !limits.AllowLoopback {
		return &EgressError{Reason: "loopback_blocked", Detail: ip.String()}
	}
	if ip.IsUnspecified() || ip.IsMulticast() || ip.IsInterfaceLocalMulticast() {
		return &EgressError{Reason: "address_not_routable", Detail: ip.String()}
	}
	if ip.IsLinkLocalUnicast() || ip.IsLinkLocalMulticast() {
		return &EgressError{Reason: "link_local_blocked", Detail: ip.String()}
	}
	if ip.IsPrivate() && !limits.AllowPrivateHosts {
		return &EgressError{
			Reason: "private_address_blocked",
			Detail: ip.String() + " requires explicit per-project approval",
		}
	}
	return nil
}

// ValidateResolvedAddress is called for every dialled address, after DNS. A name
// that passed ValidateEgressURL can still resolve to a private address, either
// by misconfiguration or by deliberate rebinding, so the decision is made on the
// address actually being connected to.
func ValidateResolvedAddress(address string, limits EgressLimits) error {
	host, _, err := net.SplitHostPort(address)
	if err != nil {
		host = address
	}
	ip := net.ParseIP(host)
	if ip == nil {
		return &EgressError{Reason: "unresolvable_address", Detail: address}
	}
	return validateIP(ip, limits)
}

// NewEgressClient builds the only HTTP client a connector may use. Redirects are
// re-validated per hop rather than trusted because the first response passed.
func NewEgressClient(limits EgressLimits) *http.Client {
	dialer := &net.Dialer{Timeout: limits.RequestTimeout, KeepAlive: 30 * time.Second}
	transport := &http.Transport{
		DialContext: func(ctx context.Context, network, address string) (net.Conn, error) {
			if err := ValidateResolvedAddress(address, limits); err != nil {
				return nil, err
			}
			return dialer.DialContext(ctx, network, address)
		},
		TLSHandshakeTimeout:   limits.RequestTimeout,
		ResponseHeaderTimeout: limits.RequestTimeout,
		DisableCompression:    false,
		MaxIdleConns:          limits.MaxConcurrency,
		MaxIdleConnsPerHost:   limits.MaxConcurrency,
		ForceAttemptHTTP2:     true,
	}
	return &http.Client{
		Transport: transport,
		Timeout:   limits.RequestTimeout,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if len(via) >= limits.MaxRedirects {
				return &EgressError{
					Reason: "too_many_redirects",
					Detail: fmt.Sprintf("exceeded %d hops", limits.MaxRedirects),
				}
			}
			if _, err := ValidateEgressURL(req.URL.String(), limits); err != nil {
				return err
			}
			return nil
		},
	}
}
