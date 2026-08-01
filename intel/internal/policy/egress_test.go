package policy

import (
	"net/http"
	"strings"
	"testing"
)

// A public-web research tool fetches attacker-influenced URLs by design, so the
// egress layer is the control that keeps it from becoming an SSRF proxy. Every
// case below is a way that has worked against real crawlers.
func TestEgressURLCorpus(t *testing.T) {
	limits := DefaultEgressLimits("AGENTintel/test")

	blocked := []struct {
		name   string
		raw    string
		reason string
	}{
		{"loopback by name", "http://localhost/admin", "loopback_blocked"},
		{"loopback literal", "http://127.0.0.1:3210/api/v1/projects", "loopback_blocked"},
		{"loopback alternate literal", "http://127.1/", "loopback_blocked"},
		{"loopback as integer", "http://2130706433/", "loopback_blocked"},
		{"loopback in hex", "http://0x7f.0.0.1/", "loopback_blocked"},
		{"loopback in octal", "http://0177.0.0.1/", "loopback_blocked"},
		{"metadata as integer", "http://2852039166/", "metadata_endpoint_blocked"},
		{"subdomain of localhost", "http://api.localhost/", "loopback_blocked"},
		{"google metadata by name", "http://metadata.google.internal/", "loopback_blocked"},
		{"trailing dot localhost", "http://localhost./", "loopback_blocked"},
		{"ipv6 loopback", "http://[::1]/", "loopback_blocked"},
		{"unspecified", "http://0.0.0.0/", "address_not_routable"},
		{"aws metadata", "http://169.254.169.254/latest/meta-data/", "metadata_endpoint_blocked"},
		{"alibaba metadata", "http://100.100.100.200/latest/meta-data/", "metadata_endpoint_blocked"},
		{"link local", "http://169.254.10.1/", "link_local_blocked"},
		{"rfc1918 ten", "http://10.0.0.5/", "private_address_blocked"},
		{"rfc1918 172", "http://172.16.0.1/", "private_address_blocked"},
		{"rfc1918 192", "http://192.168.1.1/", "private_address_blocked"},
		{"file scheme", "file:///etc/passwd", "scheme_not_allowed"},
		{"gopher scheme", "gopher://example.com/", "scheme_not_allowed"},
		{"ftp scheme", "ftp://example.com/", "scheme_not_allowed"},
		{"embedded credentials", "https://user:pass@example.com/", "userinfo_not_allowed"},
		{"unexpected port", "http://example.com:22/", "port_not_allowed"},
		{"redis port", "http://example.com:6379/", "port_not_allowed"},
		{"no host", "http:///path", "missing_host"},
	}

	for _, testCase := range blocked {
		t.Run(testCase.name, func(t *testing.T) {
			_, err := ValidateEgressURL(testCase.raw, limits)
			if err == nil {
				t.Fatalf("%s was allowed; it must be refused", testCase.raw)
			}
			egressErr, ok := err.(*EgressError)
			if !ok {
				t.Fatalf("expected an EgressError, got %T", err)
			}
			if egressErr.Reason != testCase.reason {
				t.Fatalf("refused %s as %q, expected %q",
					testCase.raw, egressErr.Reason, testCase.reason)
			}
		})
	}

	allowed := []string{
		"https://example.com/",
		"https://example.com:443/feed.xml",
		"http://example.com:8080/rss",
		"https://sub.domain.example.com/blog/atom.xml",
	}
	for _, raw := range allowed {
		if _, err := ValidateEgressURL(raw, limits); err != nil {
			t.Fatalf("%s should be allowed, refused with %v", raw, err)
		}
	}
}

// A hostname that passes URL validation can still resolve to a private address,
// which is the DNS-rebinding shape. The decision has to be made on the address
// actually dialled.
func TestResolvedAddressIsCheckedAfterDNS(t *testing.T) {
	limits := DefaultEgressLimits("AGENTintel/test")

	for _, address := range []string{
		"127.0.0.1:3210",
		"169.254.169.254:80",
		"10.1.2.3:443",
		"192.168.0.10:8080",
		"[::1]:443",
	} {
		if err := ValidateResolvedAddress(address, limits); err == nil {
			t.Fatalf("dialling %s must be refused after DNS", address)
		}
	}

	if err := ValidateResolvedAddress("93.184.216.34:443", limits); err != nil {
		t.Fatalf("a public address must be dialable, got %v", err)
	}
}

// Allowing private hosts is an explicit operator decision for one project. It
// must never re-open the metadata endpoint or the loopback API, because those
// are not what an operator means by "my internal wiki".
func TestPrivateHostApprovalDoesNotUnblockMetadataOrLoopback(t *testing.T) {
	limits := DefaultEgressLimits("AGENTintel/test")
	limits.AllowPrivateHosts = true

	if err := ValidateResolvedAddress("10.0.0.5:443", limits); err != nil {
		t.Fatalf("approved private space should be reachable, got %v", err)
	}
	for _, address := range []string{"169.254.169.254:80", "127.0.0.1:3210", "[::1]:443"} {
		if err := ValidateResolvedAddress(address, limits); err == nil {
			t.Fatalf("%s must stay blocked even with private hosts approved", address)
		}
	}
}

func TestRedirectHopsAreRevalidated(t *testing.T) {
	limits := DefaultEgressLimits("AGENTintel/test")
	client := NewEgressClient(limits)
	if client.CheckRedirect == nil {
		t.Fatal("the egress client must re-validate redirects")
	}

	// A redirect into the loopback API is the classic escape from a public URL.
	request, err := http.NewRequest(http.MethodGet, "http://127.0.0.1:3210/api/v1/projects", nil)
	if err != nil {
		t.Fatal(err)
	}
	if err := client.CheckRedirect(request, nil); err == nil {
		t.Fatal("a redirect to the loopback API must be refused")
	}

	// The hop budget is enforced independently of the destination.
	public, err := http.NewRequest(http.MethodGet, "https://example.com/", nil)
	if err != nil {
		t.Fatal(err)
	}
	via := make([]*http.Request, limits.MaxRedirects)
	if err := client.CheckRedirect(public, via); err == nil {
		t.Fatal("exceeding the redirect budget must be refused")
	} else if !strings.Contains(err.Error(), "too_many_redirects") {
		t.Fatalf("expected a redirect-budget refusal, got %v", err)
	}
}

// The loopback allowance is test-only. If a default ever ships with it enabled,
// the daemon's own API becomes reachable from an attacker-supplied URL.
func TestDefaultLimitsRefuseLoopback(t *testing.T) {
	limits := DefaultEgressLimits("AGENTintel/test")
	if limits.AllowLoopback {
		t.Fatal("AllowLoopback must default to false")
	}
	if err := ValidateResolvedAddress("127.0.0.1:3210", limits); err == nil {
		t.Fatal("the default limits must refuse the loopback API")
	}
	// Even with loopback allowed for a test, metadata stays refused.
	limits.AllowLoopback = true
	if err := ValidateResolvedAddress("169.254.169.254:80", limits); err == nil {
		t.Fatal("metadata must stay blocked even when loopback is allowed")
	}
}
