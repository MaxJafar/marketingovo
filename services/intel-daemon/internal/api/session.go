package api

import (
	"crypto/sha256"
	"crypto/subtle"
	"net"
	"net/http"
	"net/url"
	"time"
)

const (
	browserSessionCookie = "marketingovo_session"
	browserSessionTTL    = 8 * time.Hour
)

type browserSession struct {
	CSRF      string
	ExpiresAt time.Time
}

type sessionResponse struct {
	CSRF      string    `json:"csrf"`
	ExpiresAt time.Time `json:"expires_at"`
}

func (server *Server) bootstrapSession(writer http.ResponseWriter, request *http.Request) {
	if !isIPv4LoopbackRemote(request.RemoteAddr) || !requestHasSameOrigin(request) {
		writeProblem(writer, request, http.StatusForbidden, "loopback_required", "Dashboard bootstrap is available only from the same loopback origin")
		return
	}
	var input struct {
		Token string `json:"token"`
	}
	if err := decodeJSON(writer, request, &input, false); err != nil {
		writeProblem(writer, request, http.StatusBadRequest, "invalid_request", err.Error())
		return
	}
	if err := ValidateToken(input.Token); err != nil {
		writeProblem(writer, request, http.StatusUnauthorized, "bootstrap_invalid", "The dashboard bootstrap ticket is invalid or already used")
		return
	}
	sessionToken, err := GenerateToken()
	if err != nil {
		writeProblem(writer, request, http.StatusInternalServerError, "session_creation_failed", "Could not create a dashboard session")
		return
	}
	csrf, err := GenerateToken()
	if err != nil {
		writeProblem(writer, request, http.StatusInternalServerError, "session_creation_failed", "Could not create a dashboard session")
		return
	}
	candidateHash := sha256.Sum256([]byte(input.Token))
	server.sessionMu.Lock()
	valid := server.bootstrapAvailable && subtle.ConstantTimeCompare(candidateHash[:], server.bootstrapHash[:]) == 1
	if valid {
		server.bootstrapAvailable = false
		expires := time.Now().UTC().Add(browserSessionTTL)
		server.sessions[sha256.Sum256([]byte(sessionToken))] = browserSession{CSRF: csrf, ExpiresAt: expires}
		server.sessionMu.Unlock()
		setBrowserSessionCookie(writer, sessionToken, expires)
		writeJSON(writer, http.StatusOK, sessionResponse{CSRF: csrf, ExpiresAt: expires})
		return
	}
	server.sessionMu.Unlock()
	writeProblem(writer, request, http.StatusUnauthorized, "bootstrap_invalid", "The dashboard bootstrap ticket is invalid or already used")
}

func (server *Server) getSession(writer http.ResponseWriter, request *http.Request) {
	session, ok := server.readBrowserSession(request, true)
	if !ok {
		writeProblem(writer, request, http.StatusUnauthorized, "session_invalid", "The dashboard session is absent or expired")
		return
	}
	cookie, _ := request.Cookie(browserSessionCookie)
	if cookie != nil {
		setBrowserSessionCookie(writer, cookie.Value, session.ExpiresAt)
	}
	writeJSON(writer, http.StatusOK, sessionResponse{CSRF: session.CSRF, ExpiresAt: session.ExpiresAt})
}

func (server *Server) readBrowserSession(request *http.Request, refresh bool) (browserSession, bool) {
	cookie, err := request.Cookie(browserSessionCookie)
	if err != nil || ValidateToken(cookie.Value) != nil {
		return browserSession{}, false
	}
	key := sha256.Sum256([]byte(cookie.Value))
	now := time.Now().UTC()
	server.sessionMu.Lock()
	defer server.sessionMu.Unlock()
	session, present := server.sessions[key]
	if !present || !session.ExpiresAt.After(now) {
		delete(server.sessions, key)
		return browserSession{}, false
	}
	if refresh {
		session.ExpiresAt = now.Add(browserSessionTTL)
		server.sessions[key] = session
	}
	return session, true
}

func setBrowserSessionCookie(writer http.ResponseWriter, token string, expires time.Time) {
	http.SetCookie(writer, &http.Cookie{
		Name: browserSessionCookie, Value: token, Path: "/v1/", HttpOnly: true,
		SameSite: http.SameSiteStrictMode, Secure: false, Expires: expires,
		MaxAge: int(time.Until(expires).Seconds()),
	})
}

func isIPv4LoopbackRemote(remoteAddress string) bool {
	host, _, err := net.SplitHostPort(remoteAddress)
	if err != nil {
		return false
	}
	address := net.ParseIP(host)
	return address != nil && address.To4() != nil && address.Equal(net.ParseIP("127.0.0.1"))
}

func requestHasSameOrigin(request *http.Request) bool {
	origin := request.Header.Get("Origin")
	if origin == "" {
		return false
	}
	parsed, err := url.Parse(origin)
	return err == nil && parsed.Scheme == "http" && parsed.Host == request.Host && parsed.User == nil
}
