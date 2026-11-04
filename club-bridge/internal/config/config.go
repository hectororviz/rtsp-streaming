package config

import (
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"strings"

	"gopkg.in/yaml.v3"
)

// Config es la configuracion completa del puente. Nada hardcodeado:
// todo valor tiene default razonable y puede sobreescribirse por env.
type Config struct {
	Input struct {
		RTSPURL    string `yaml:"rtsp_url"`
		Transport  string `yaml:"transport"`
		TimeoutSec int    `yaml:"timeout_sec"`
	} `yaml:"input"`

	Output struct {
		Endpoint string `yaml:"endpoint"`
		// Usuario para publicar en MediaMTX. Password NUNCA en archivo:
		// se lee del env indicado en PublishPasswordEnv.
		PublishUser        string `yaml:"publish_user"`
		PublishPasswordEnv string `yaml:"publish_password_env"`
		CopyCodec          bool   `yaml:"copy_codec"`
		// Args extra pasados tal cual a ffmpeg (ej: ["-bufsize","2M"]).
		ExtraFFmpegArgs []string `yaml:"extra_ffmpeg_args"`
	} `yaml:"output"`

	Supervision struct {
		RestartDelaySec int `yaml:"restart_delay_sec"`
		// 0 = reintentos infinitos (recomendado en el club).
		MaxRetries int `yaml:"max_retries"`
	} `yaml:"supervision"`

	Health struct {
		Enabled bool `yaml:"enabled"`
		Port    int  `yaml:"port"`
	} `yaml:"health"`

	LogLevel string `yaml:"log_level"`

	// Resuelto en runtime, no va en yaml.
	configPath string
	PublishPassword string `yaml:"-"`
}

// Defaults aplicados cuando el yaml omite el campo.
func defaults(c *Config) {
	if c.Input.Transport == "" {
		c.Input.Transport = "tcp"
	}
	if c.Input.TimeoutSec == 0 {
		c.Input.TimeoutSec = 10
	}
	if c.Output.PublishPasswordEnv == "" {
		c.Output.PublishPasswordEnv = "BRIDGE_PUBLISH_PASSWORD"
	}
	if c.Supervision.RestartDelaySec == 0 {
		c.Supervision.RestartDelaySec = 5
	}
	// MaxRetries 0 = infinito, se deja tal cual.
	if c.Health.Port == 0 {
		c.Health.Port = 8081
	}
	// health enabled default true solo si no se especifico? yaml bool
	// no distingue; lo resolvemos: si port>0 asumimos enabled salvo false explicito.
	// Para mantenerlo simple: default enabled=true.
	if !c.Health.Enabled && c.Health.Port != 0 {
		// Si el usuario puso port pero no enabled, igual lo prendemos.
		// Solo se apaga con enabled: false explicito + manejo en override.
		c.Health.Enabled = true
	}
	if c.LogLevel == "" {
		c.LogLevel = "info"
	}
	// copy_codec default true: yaml false es ambiguo, asi que si el usuario
	// no lo aclara lo forzamos a true salvo que pida transcode explicito.
	// Detectamos "campo ausente" re-leyendo? Simplificacion: default true
	// siempre que ExtraFFmpegArgs no indique codec. El validate no lo exige.
}

// ResolveConfigPath: --config > $BRIDGE_CONFIG > ./config.yaml > /etc/stream-bridge/config.yaml
func ResolveConfigPath(flagPath string) (string, error) {
	candidates := []string{}
	if strings.TrimSpace(flagPath) != "" {
		candidates = append(candidates, flagPath)
	}
	if env := strings.TrimSpace(os.Getenv("BRIDGE_CONFIG")); env != "" {
		candidates = append(candidates, env)
	}
	candidates = append(candidates, "config.yaml", "./config.yaml")
	if exe, err := os.Executable(); err == nil {
		candidates = append(candidates, filepath.Join(filepath.Dir(exe), "config.yaml"))
	}
	candidates = append(candidates, "/etc/stream-bridge/config.yaml")

	seen := map[string]bool{}
	for _, p := range candidates {
		if seen[p] {
			continue
		}
		seen[p] = true
		if p == "" {
			continue
		}
		if st, err := os.Stat(p); err == nil && !st.IsDir() {
			return p, nil
		}
	}
	return "", fmt.Errorf("no se encontro archivo de configuracion (probe: %s). Usa --config <path> o BRIDGE_CONFIG", strings.Join(candidates, ", "))
}

// Load lee yaml + aplica overrides de entorno + defaults.
func Load(path string) (*Config, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("leyendo config %s: %w", path, err)
	}
	c := &Config{}
	// copy_codec debe defaultear true: preset antes de unmarshal.
	c.Output.CopyCodec = true
	if err := yaml.Unmarshal(data, c); err != nil {
		return nil, fmt.Errorf("parseando yaml %s: %w", path, err)
	}
	c.configPath = path
	defaults(c)
	applyEnvOverrides(c)
	// Password se resuelve aca (no queda en archivo).
	c.PublishPassword = os.Getenv(c.Output.PublishPasswordEnv)
	// Caso especial: permiten setear password directo por env generico.
	if c.PublishPassword == "" {
		if v := os.Getenv("BRIDGE_PUBLISH_PASSWORD"); v != "" {
			c.PublishPassword = v
		}
	}
	if err := c.Validate(); err != nil {
		return nil, err
	}
	return c, nil
}

func applyEnvOverrides(c *Config) {
	if v := os.Getenv("BRIDGE_RTSP_URL"); v != "" {
		c.Input.RTSPURL = v
	}
	if v := os.Getenv("BRIDGE_TRANSPORT"); v != "" {
		c.Input.Transport = v
	}
	if v := os.Getenv("BRIDGE_ENDPOINT"); v != "" {
		c.Output.Endpoint = v
	}
	if v := os.Getenv("BRIDGE_PUBLISH_USER"); v != "" {
		c.Output.PublishUser = v
	}
	if v := os.Getenv("BRIDGE_PUBLISH_PASSWORD_ENV"); v != "" {
		c.Output.PublishPasswordEnv = v
	}
	if v := os.Getenv("BRIDGE_LOG_LEVEL"); v != "" {
		c.LogLevel = v
	}
	if v := os.Getenv("BRIDGE_HEALTH_PORT"); v != "" {
		var p int
		if _, err := fmt.Sscanf(v, "%d", &p); err == nil {
			c.Health.Port = p
		}
	}
	if v := os.Getenv("BRIDGE_HEALTH_ENABLED"); v != "" {
		c.Health.Enabled = v == "1" || strings.EqualFold(v, "true") || strings.EqualFold(v, "yes")
	}
}

// Validate chequea todo con mensajes accionables.
func (c *Config) Validate() error {
	if strings.TrimSpace(c.Input.RTSPURL) == "" {
		return fmt.Errorf("input.rtsp_url vacio (ej: rtsp://user:pass@192.168.1.10:554/cam). Puede venir de BRIDGE_RTSP_URL")
	}
	if !strings.HasPrefix(c.Input.RTSPURL, "rtsp://") {
		return fmt.Errorf("input.rtsp_url debe empezar con rtsp:// (recibi: %s)", c.Input.RTSPURL)
	}
	t := strings.ToLower(strings.TrimSpace(c.Input.Transport))
	if t != "tcp" && t != "udp" {
		return fmt.Errorf("input.transport debe ser tcp o udp (recibi: %s)", c.Input.Transport)
	}
	c.Input.Transport = t
	if c.Input.TimeoutSec < 1 || c.Input.TimeoutSec > 120 {
		return fmt.Errorf("input.timeout_sec debe estar entre 1 y 120 (recibi: %d)", c.Input.TimeoutSec)
	}
	if strings.TrimSpace(c.Output.Endpoint) == "" {
		return fmt.Errorf("output.endpoint vacio (ej: rtsp://vps:8554/live/partido1). Puede venir de BRIDGE_ENDPOINT")
	}
	ep := strings.ToLower(c.Output.Endpoint)
	if !(strings.HasPrefix(ep, "rtsp://") || strings.HasPrefix(ep, "rtmp://") || strings.HasPrefix(ep, "srt://")) {
		return fmt.Errorf("output.endpoint debe empezar con rtsp://, rtmp:// o srt:// (recibi: %s)", c.Output.Endpoint)
	}
	if c.Supervision.RestartDelaySec < 1 || c.Supervision.RestartDelaySec > 300 {
		return fmt.Errorf("supervision.restart_delay_sec debe estar entre 1 y 300 (recibi: %d)", c.Supervision.RestartDelaySec)
	}
	if c.Supervision.MaxRetries < 0 {
		return fmt.Errorf("supervision.max_retries debe ser >= 0 (0=infinito)")
	}
	if c.Health.Enabled && (c.Health.Port < 1 || c.Health.Port > 65535) {
		return fmt.Errorf("health.port invalido: %d", c.Health.Port)
	}
	ll := strings.ToLower(strings.TrimSpace(c.LogLevel))
	switch ll {
	case "debug", "info", "warn", "error":
		c.LogLevel = ll
	default:
		return fmt.Errorf("log_level debe ser debug|info|warn|error (recibi: %s)", c.LogLevel)
	}
	return nil
}

// PublishURL devuelve el endpoint con credenciales inyectadas si hay user.
// Soporta rtsp://host/path -> rtsp://user:pass@host/path
func (c *Config) PublishURL() string {
	if c.Output.PublishUser == "" {
		return c.Output.Endpoint
	}
	u, err := url.Parse(c.Output.Endpoint)
	if err != nil || u.Host == "" {
		return c.Output.Endpoint
	}
	if c.PublishPassword != "" {
		u.User = url.UserPassword(c.Output.PublishUser, c.PublishPassword)
	} else {
		u.User = url.User(c.Output.PublishUser)
	}
	return u.String()
}

// RedactedURL para logs (oculta password).
func (c *Config) RedactedURL() string {
	u, err := url.Parse(c.PublishURL())
	if err != nil || u.Host == "" {
		return "(endpoint invalido)"
	}
	if u.User != nil {
		name := u.User.Username()
		u.User = url.User(name)
		return u.String() + " (password oculto)"
	}
	return u.String()
}

func (c *Config) Path() string { return c.configPath }
