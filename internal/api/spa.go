package api

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"
)

func newSPAHandler(directory string) http.Handler {
	root, rootErr := filepath.Abs(directory)
	if directory == "" {
		rootErr = fmt.Errorf("dashboard directory is not configured")
	}
	if rootErr == nil {
		root, rootErr = filepath.EvalSymlinks(root)
	}
	index := filepath.Join(root, "index.html")
	if rootErr == nil {
		if info, err := os.Stat(index); err != nil || !info.Mode().IsRegular() {
			rootErr = fmt.Errorf("dashboard index is unavailable")
		}
	}
	return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if rootErr != nil {
			writer.Header().Set("Content-Type", "text/plain; charset=utf-8")
			writer.WriteHeader(http.StatusServiceUnavailable)
			_, _ = io.WriteString(writer, "Golem Intel dashboard assets are unavailable; build apps/dashboard/dist or pass --dashboard-dir.\n")
			return
		}
		cleanURL := path.Clean("/" + request.URL.Path)
		candidate := filepath.Join(root, filepath.FromSlash(strings.TrimPrefix(cleanURL, "/")))
		if cleanURL == "/" {
			candidate = index
		}
		if resolved, err := filepath.EvalSymlinks(candidate); err == nil && containedPath(root, resolved) {
			if info, statErr := os.Stat(resolved); statErr == nil && info.Mode().IsRegular() {
				serveDashboardFile(writer, request, resolved, info, resolved == index)
				return
			}
		}
		indexInfo, err := os.Stat(index)
		if err != nil {
			http.NotFound(writer, request)
			return
		}
		serveDashboardFile(writer, request, index, indexInfo, true)
	})
}

func serveDashboardFile(writer http.ResponseWriter, request *http.Request, filename string, info os.FileInfo, index bool) {
	file, err := os.Open(filename)
	if err != nil {
		http.NotFound(writer, request)
		return
	}
	defer file.Close()
	if index {
		writer.Header().Set("Cache-Control", "no-store")
	} else {
		writer.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
	}
	http.ServeContent(writer, request, info.Name(), info.ModTime(), file)
}
