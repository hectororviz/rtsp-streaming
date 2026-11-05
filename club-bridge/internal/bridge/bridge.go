package bridge

import (
	"bufio"
	"context"
	"fmt"
	"log"
	"os"
	"os/exec"
	"regexp"
	"strings"
	"sync/atomic"
	"time"

	"club-bridge/internal/config"
)

// Stats expuestas al health endpoint.
type Stats struct {
	Running    atomic.Bool
	Restarts   atomic.Int64
	LastExit   atomic.Value // string
	StartedAt  time.Time
	FFmpegArgs atomic.Value // []string
}

func (s *Stats) LastExitStr() string {
	v := s.LastExit.Load()
	if v == nil {
		return ""
	}
	if str, ok := v.(string); ok {
		return str
	}
	return ""
}

// FindFFmpeg verifica que haya ffmpeg en PATH.
func FindFFmpeg() (string, error) {
	p, err := exec.LookPath("ffmpeg")
	if err != nil {
		return "", fmt.Errorf("no se encontro `ffmpeg` en PATH. Instalalo (Ubuntu: sudo apt install ffmpeg / Arch: sudo pacman -S ffmpeg) y reintenta")
	}
	return p, nil
}

// BuildArgs arma el comando ffmpeg. Sin recodificar por defecto (-c copy).
func BuildArgs(c *config.Config) []string {
	// timeout va en microsegundos (opcion del demuxer rtsp).
	timeoutUs := fmt.Sprintf("%d", c.Input.TimeoutSec*1000000)
	args := []string{
		"-hide_banner",
		"-loglevel", ffmpegLogLevel(c.LogLevel),
		"-rtsp_transport", c.Input.Transport,
		"-timeout", timeoutUs,
		// Sin flags -reconnect*: el demuxer RTSP no los acepta ("Option not found").
		// La reconexion la maneja el supervisor (restart con backoff).
		"-i", c.Input.RTSPURL,
	}
	if c.Output.CopyCodec {
		args = append(args, "-c", "copy")
	}
	args = append(args, c.Output.ExtraFFmpegArgs...)
	// El output RTSP debe ir por TCP interleaved: el VPS solo expone
	// 10.8.0.1:8554/TCP por el tunel (sin forwarding UDP).
	args = append(args, "-rtsp_transport", "tcp")
	args = append(args, "-f", "rtsp", c.PublishURL())
	return args
}

func ffmpegLogLevel(level string) string {
	switch level {
	case "debug":
		return "info" // ffmpeg "debug" es demasiado verboso; info alcanza.
	case "warn":
		return "warning"
	case "error":
		return "error"
	default:
		return "warning"
	}
}

// Run supervisa ffmpeg hasta cancelar contexto o agotar reintentos.
// 0 reintentos = infinito.
func Run(ctx context.Context, c *config.Config, stats *Stats, logger *log.Logger) int {
	ffbin, err := FindFFmpeg()
	if err != nil {
		logger.Printf("ERROR: %v", err)
		return 2
	}
	args := BuildArgs(c)
	stats.FFmpegArgs.Store(args)
	stats.StartedAt = time.Now()

	logger.Printf("config: %s", c.Path())
	logger.Printf("origen: %s (transport=%s)", redactRTSP(c.Input.RTSPURL), c.Input.Transport)
	logger.Printf("destino: %s", c.RedactedURL())
	logger.Printf("ffmpeg: %s %s", ffbin, strings.Join(redactArgs(args), " "))

	attempt := 0
	for {
		if ctx.Err() != nil {
			logger.Printf("detenido (contexto cancelado)")
			return 0
		}
		if c.Supervision.MaxRetries > 0 && attempt >= c.Supervision.MaxRetries {
			logger.Printf("ERROR: max_retries alcanzado (%d), saliendo", c.Supervision.MaxRetries)
			return 1
		}
		if attempt > 0 {
			stats.Restarts.Add(1)
		}
		code := runOnce(ctx, ffbin, args, c, stats, logger, attempt)
		if ctx.Err() != nil {
			return 0
		}
		// Salida limpia de ffmpeg (0) igual reintentamos: en streaming
		// nunca deberia terminar solo; si termino, algo se corto.
		attempt++
		wait := time.Duration(c.Supervision.RestartDelaySec) * time.Second
		logger.Printf("ffmpeg termino (exit=%d). Reintento %d en %v ...", code, attempt, wait)
		select {
		case <-ctx.Done():
			return 0
		case <-time.After(wait):
		}
	}
}

func runOnce(ctx context.Context, ffbin string, args []string, c *config.Config, stats *Stats, logger *log.Logger, attempt int) int {
	cmd := exec.CommandContext(ctx, ffbin, args...)
	stderr, err := cmd.StderrPipe()
	if err != nil {
		stats.LastExit.Store(fmt.Sprintf("pipe: %v", err))
		return 127
	}
	cmd.Stdout = os.Stdout
	if err := cmd.Start(); err != nil {
		msg := fmt.Sprintf("no se pudo lanzar ffmpeg: %v", err)
		logger.Printf("ERROR: %s", msg)
		stats.LastExit.Store(msg)
		return 127
	}
	stats.Running.Store(true)
	logger.Printf("ffmpeg pid=%d (intento %d)", cmd.Process.Pid, attempt+1)

	// Log de ffmpeg en background, filtrado a lineas utiles en modo info.
	go func() {
		sc := bufio.NewScanner(stderr)
		// Lineas de ffmpeg pueden ser largas; subir buffer.
		sc.Buffer(make([]byte, 64*1024), 1024*1024)
		for sc.Scan() {
			line := sc.Text()
			if c.LogLevel == "debug" || c.LogLevel == "info" {
				// En info mostramos errores y estado cada tanto; ffmpeg
				// escupe mucho, asi que solo lineas con senal de problema.
				low := strings.ToLower(line)
				if strings.Contains(low, "error") || strings.Contains(low, "failed") ||
					strings.Contains(low, "timeout") || strings.Contains(low, "connection") ||
					c.LogLevel == "debug" {
					logger.Printf("[ffmpeg] %s", redactCredentials(line))
				}
			}
		}
	}()

	err = cmd.Wait()
	stats.Running.Store(false)
	code := 0
	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			code = exitErr.ExitCode()
		} else {
			code = 1
		}
	}
	stats.LastExit.Store(fmt.Sprintf("exit=%d at=%s", code, time.Now().Format(time.RFC3339)))
	return code
}

// redactCredentials oculta user:pass en cualquier linea (logs de ffmpeg, etc).
var credRe = regexp.MustCompile(`://[^/@\s:]+:[^/@\s]+@`)

func redactCredentials(s string) string {
	return credRe.ReplaceAllString(s, "://***:***@")
}

func redactRTSP(raw string) string {
	// Oculta user:pass@ del RTSP de origen en logs.
	at := strings.LastIndex(raw, "@")
	proto := strings.Index(raw, "://")
	if at > 0 && proto > 0 && at > proto {
		return raw[:proto+3] + "***:***@" + raw[at+1:]
	}
	return raw
}

func redactArgs(args []string) []string {
	out := make([]string, len(args))
	copy(out, args)
	for i, a := range out {
		if strings.Contains(a, "@") && (strings.HasPrefix(a, "rtsp://") || strings.HasPrefix(a, "rtmp://") || strings.HasPrefix(a, "srt://")) {
			// Oculta password embebido.
			if u := redactRTSP(a); u != a {
				out[i] = u + " (oculto)"
			}
		}
		if strings.HasPrefix(a, "rtsp://") && strings.Contains(a, ":") {
			// caso user:pass@ ya cubierto arriba
		}
	}
	return out
}
