package health

import (
	"encoding/json"
	"net/http"
	"time"

	"club-bridge/internal/bridge"
)

// Server HTTP minimo para monitoreo (/healthz). Sin dependencias.
type Server struct {
	stats *bridge.Stats
	srv   *http.Server
}

func New(stats *bridge.Stats, port int) *Server {
	mux := http.NewServeMux()
	s := &Server{stats: stats}
	mux.HandleFunc("/healthz", s.handle)
	mux.HandleFunc("/health", s.handle)
	s.srv = &http.Server{Addr: addr(port), Handler: mux}
	return s
}

func addr(port int) string { return "0.0.0.0:" + itoa(port) }

func (s *Server) Start() {
	go func() { _ = s.srv.ListenAndServe() }()
}

func (s *Server) Stop() {
	_ = s.srv.Close()
}

func (s *Server) handle(w http.ResponseWriter, _ *http.Request) {
	args, _ := s.stats.FFmpegArgs.Load().([]string)
	_ = args
	resp := map[string]any{
		"status":        "ok",
		"ffmpeg_running": s.stats.Running.Load(),
		"restarts":      s.stats.Restarts.Load(),
		"last_exit":     s.stats.LastExitStr(),
		"started_at":    s.stats.StartedAt.Format(time.RFC3339),
		"uptime_sec":    int64(time.Since(s.stats.StartedAt).Seconds()),
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(resp)
}

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	buf := [8]byte{}
	pos := len(buf)
	for n > 0 {
		pos--
		buf[pos] = byte('0' + n%10)
		n /= 10
	}
	return string(buf[pos:])
}
