// club-bridge: puente DVR(RTSP) -> VPS. Sin nada hardcodeado: todo por config.yaml + env.
package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"os"
	"os/signal"
	"strings"
	"syscall"

	"club-bridge/internal/bridge"
	"club-bridge/internal/config"
	"club-bridge/internal/health"
)

var version = "0.1.0"

func main() {
	os.Exit(run())
}

func run() int {
	// Acepta --config tanto antes como despues del subcomando:
	// extrae manual antes de flag.Parse (stdlib no parsea flags post-arg).
	configPath := extractConfigFlag(&os.Args)
	var (
		configFlag = flag.String("config", configPath, "ruta al config.yaml (tambien BRIDGE_CONFIG)")
		logPrefix  = "[club-bridge] "
	)
	flag.Usage = func() {
		fmt.Fprintf(os.Stderr, `club-bridge v%s - puente RTSP DVR -> VPS

Uso:
  club-bridge [--config <path>] [run]      publica y supervisa ffmpeg (default)
  club-bridge validate [--config <path>]   valida config y sale
  club-bridge print-ffmpeg [--config]      muestra el comando ffmpeg sin correrlo
  club-bridge version                      muestra version

Resolucion de config:
  --config > $BRIDGE_CONFIG > ./config.yaml > /etc/stream-bridge/config.yaml

Env overrides (pisan el yaml):
  BRIDGE_RTSP_URL, BRIDGE_TRANSPORT, BRIDGE_ENDPOINT,
  BRIDGE_PUBLISH_USER, BRIDGE_PUBLISH_PASSWORD / $BRIDGE_PUBLISH_PASSWORD_ENV,
  BRIDGE_LOG_LEVEL, BRIDGE_HEALTH_PORT, BRIDGE_HEALTH_ENABLED

Ejemplos:
  club-bridge --config ./config.yaml
  BRIDGE_RTSP_URL=rtsp://x BRIDGE_ENDPOINT=rtsp://vps:8554/live/test club-bridge validate
`, version)
		flag.PrintDefaults()
	}
	flag.Parse()

	logger := log.New(os.Stdout, logPrefix, log.LstdFlags)

	args := flag.Args()
	cmd := "run"
	if len(args) > 0 {
		cmd = strings.ToLower(args[0])
	}

	switch cmd {
	case "version", "-v", "--version":
		fmt.Printf("club-bridge v%s\n", version)
		return 0
	case "validate", "print-ffmpeg":
		path, err := config.ResolveConfigPath(*configFlag)
		if err != nil {
			logger.Printf("ERROR: %v", err)
			return 2
		}
		cfg, err := config.Load(path)
		if err != nil {
			logger.Printf("ERROR config invalida: %v", err)
			return 2
		}
		if cmd == "validate" {
			if _, err := bridge.FindFFmpeg(); err != nil {
				logger.Printf("WARN: config OK pero %v", err)
				return 0 // config valida aunque falte ffmpeg en esta maquina
			}
			logger.Printf("OK config valida: %s -> %s", path, cfg.RedactedURL())
			return 0
		}
		for _, a := range bridge.BuildArgs(cfg) {
			fmt.Printf("%s ", quote(a))
		}
		fmt.Println()
		return 0
	case "run", "":
		// sigue abajo
	default:
		logger.Printf("ERROR: comando desconocido %q (usa run|validate|print-ffmpeg|version)", cmd)
		return 2
	}

	path, err := config.ResolveConfigPath(*configFlag)
	if err != nil {
		logger.Printf("ERROR: %v", err)
		return 2
	}
	cfg, err := config.Load(path)
	if err != nil {
		logger.Printf("ERROR config invalida: %v", err)
		return 2
	}

	stats := &bridge.Stats{}
	if cfg.Health.Enabled {
		h := health.New(stats, cfg.Health.Port)
		h.Start()
		defer h.Stop()
		logger.Printf("health: http://0.0.0.0:%d/healthz", cfg.Health.Port)
	}

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	return bridge.Run(ctx, cfg, stats, logger)
}

func quote(s string) string {
	if strings.ContainsAny(s, " \t\"'") {
		return "'" + strings.ReplaceAll(s, "'", "'\\''") + "'"
	}
	return s
}

// extractConfigFlag busca --config <p> o --config=<p> en cualquier posicion
// y lo saca de os.Args para que flag.Parse no se confunda con el subcomando.
func extractConfigFlag(pargs *[]string) string {
	argv := *pargs
	found := ""
	kept := []string{argv[0]}
	i := 1
	for i < len(argv) {
		a := argv[i]
		if a == "--config" && i+1 < len(argv) {
			found = argv[i+1]
			i += 2
			continue
		}
		if strings.HasPrefix(a, "--config=") {
			found = strings.TrimPrefix(a, "--config=")
			i++
			continue
		}
		kept = append(kept, a)
		i++
	}
	*pargs = kept
	return found
}
