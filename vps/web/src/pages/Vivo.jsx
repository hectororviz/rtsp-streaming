import { useEffect, useRef, useState } from "react";
import Header, { LiveBadge } from "../components/Header";
import PinForm from "../components/PinForm";
import Player from "../Player";
import { api, fmtDate } from "../api";

function useCountdown(targetIso) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const target = targetIso ? new Date(targetIso).getTime() : Date.now();
  const diff = Math.max(0, target - now);
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function Vivo({ onNav }) {
  const [match, setMatch] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);
  const [hlsUrl, setHlsUrl] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [streamState, setStreamState] = useState("idle");
  const videoHolder = useRef(null);
  const cd = useCountdown(match ? match.starts_at : null);

  useEffect(() => {
    let alive = true;
    api
      .current()
      .then(async (m) => {
        if (!alive) return;
        setMatch(m);
        try {
          const me = await api.me(m.id);
          if (!alive) return;
          if (me.hasAccess) {
            setHasAccess(true);
            loadStream(m.id);
          }
        } catch {}
      })
      .catch(() => alive && setLoadError("No hay partidos cargados todavía."));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadStream(id) {
    setStreamState("loading");
    try {
      const s = await api.stream(id);
      setHlsUrl(s.hlsUrl);
      setStreamState("live");
    } catch (e) {
      if (e.body && (e.body.error === "not_started" || e.body.error === "ended")) {
        setStreamState(e.body.error === "not_started" ? "waiting" : "ended");
        if (e.body.match) setMatch(e.body.match);
      } else {
        setStreamState("denied");
      }
    }
  }

  async function submitPin(pin) {
    if (!match || busy) return;
    setBusy(true);
    try {
      await api.access(match.id, pin);
      setHasAccess(true);
      await loadStream(match.id);
    } finally {
      setBusy(false);
    }
  }

  function goFs() {
    const video = videoHolder.current?.video;
    if (!video) return;
    if (video.webkitEnterFullscreen) {
      try {
        video.webkitEnterFullscreen();
        return;
      } catch {}
    }
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
      return;
    }
    if (video.requestFullscreen) {
      video.requestFullscreen().catch(() => {
        try {
          video.webkitEnterFullscreen();
        } catch {}
      });
    }
  }

  function reload() {
    if (!match) return;
    if (streamState === "live" && hlsUrl) {
      setReloadKey((k) => k + 1);
    } else {
      loadStream(match.id);
    }
  }

  const title = match ? match.title : "CSD Soler vs Rival a definir";

  return (
    <div>
      <Header variant="vivo" onNav={onNav} />
      <div className="vivo-player-wrap">
        {hasAccess && (streamState === "live" || streamState === "loading") ? (
          <Player ref={videoHolder} src={hlsUrl} reloadKey={reloadKey} />
        ) : hasAccess && streamState === "waiting" ? (
          <div className="player player--narrow">
            <div className="player-overlay">
              <h2>El partido todavía no empezó</h2>
              <p>Comienza en {cd}. Esta página se habilita sola.</p>
            </div>
          </div>
        ) : hasAccess && streamState === "ended" ? (
          <div className="player player--narrow">
            <div className="player-overlay">
              <h2>Transmisión finalizada</h2>
              <p>Gracias por acompañar al club.</p>
            </div>
          </div>
        ) : hasAccess ? (
          <div className="player player--narrow">
            <div className="player-overlay">
              <h2>No pudimos cargar la señal</h2>
              <p>Probá recargar la señal.</p>
            </div>
          </div>
        ) : (
          <div className="player player--narrow">
            <div className="player-overlay">
              <h2>Acá va la señal en vivo</h2>
              <p>Necesitás tu acceso del club para ver el partido.</p>
            </div>
          </div>
        )}
      </div>

      <main className="container container--pad vivo-body">
        {loadError && <div className="alert">{loadError}</div>}
        <div className="live-row">
          <LiveBadge />
          {match ? <span className="date-muted">{fmtDate(match.starts_at)}</span> : null}
        </div>
        <h1>{title}</h1>

        {hasAccess ? (
          <>
            <div className="vivo-actions">
              <button className="btn btn--red" type="button" onClick={goFs}>
                ⛶ Pantalla completa
              </button>
              <button className="btn btn--ghost" type="button" onClick={reload}>
                ↻ Recargar señal
              </button>
            </div>
            <div className="note">
              ¿Se corta o se congela? Tocá «Recargar señal». Para verlo mejor en el celu, girá el teléfono y usá
              pantalla completa.
            </div>
            {streamState === "waiting" && (
              <div className="alert">La transmisión todavía no empezó. Comienza en {cd}.</div>
            )}
          </>
        ) : (
          match && <PinForm matchId={match.id} busy={busy} onSubmit={submitPin} />
        )}
      </main>
      <footer className="footer">CSD Soler TV · Transmisión oficial del club</footer>
    </div>
  );
}
