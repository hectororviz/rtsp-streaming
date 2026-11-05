import { useEffect, useState } from "react";
import { api, fmtDate } from "../api";
import Player from "../Player";

function useCountdown(targetIso) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const diff = Math.max(0, new Date(targetIso).getTime() - now);
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return { diff, text: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` };
}

export default function Home() {
  const [match, setMatch] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [busy, setBusy] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);
  const [hlsUrl, setHlsUrl] = useState("");
  const [streamState, setStreamState] = useState("idle"); // idle|loading|live|waiting|ended|denied
  const cd = useCountdown(match ? match.starts_at : new Date().toISOString());

  useEffect(() => {
    api
      .current()
      .then(async (m) => {
        setMatch(m);
        try {
          const me = await api.me(m.id);
          if (me.hasAccess) {
            setHasAccess(true);
            loadStream(m.id);
          }
        } catch {}
      })
      .catch(() => setLoadError("No hay partidos cargados todavía."));
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

  async function submitPin(ev) {
    ev.preventDefault();
    if (!match || busy) return;
    setBusy(true);
    setPinError("");
    try {
      await api.access(match.id, pin.trim());
      setHasAccess(true);
      setPin("");
      loadStream(match.id);
    } catch {
      setPinError("PIN incorrecto. Revisalo e intentá de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <header className="topbar">
        <img src="/logo.png" alt="CSD Soler" className="brand-logo" />
        <div>
          <div className="brand-name">CSD SOLER TV</div>
          <div className="brand-sub">Partidos en vivo del club</div>
        </div>
        <span className="live-pill">● EN VIVO</span>
      </header>

      <main className="wrap">
        {loadError && <div className="alert">{loadError}</div>}
        {match && (
          <section className="hero">
            <div className="hero-teams">{match.title}</div>
            <div className="hero-meta">
              <span>{fmtDate(match.starts_at)}</span>
              <StatusBadge status={match.status} />
            </div>

            {!hasAccess && (
              <form className="pin-card" onSubmit={submitPin}>
                <h2>Ingresá tu PIN de acceso</h2>
                <p>Te lo dio el club para esta transmisión de prueba.</p>
                <div className="pin-row">
                  <input
                    type="password"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="PIN"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    maxLength={32}
                  />
                  <button type="submit" disabled={busy || !pin.trim()}>
                    {busy ? "..." : "Ver partido"}
                  </button>
                </div>
                {pinError && <div className="field-error">{pinError}</div>}
              </form>
            )}

            {hasAccess && streamState === "loading" && <div className="alert">Conectando transmisión…</div>}
            {hasAccess && streamState === "live" && <Player src={hlsUrl} />}
            {hasAccess && streamState === "waiting" && (
              <div className="state-card">
                <h2>La transmisión todavía no empezó</h2>
                <p>Comienza en <strong>{cd.text}</strong>. Esta página se habilita sola.</p>
                <button onClick={() => loadStream(match.id)}>Reintentar ahora</button>
              </div>
            )}
            {hasAccess && streamState === "ended" && (
              <div className="state-card">
                <h2>Transmisión finalizada</h2>
                <p>Gracias por acompañar al club.</p>
              </div>
            )}
            {hasAccess && streamState === "denied" && (
              <div className="state-card">
                <h2>No se pudo abrir el video</h2>
                <button onClick={() => loadStream(match.id)}>Reintentar</button>
              </div>
            )}
          </section>
        )}

        <section className="how">
          <div className="how-step"><span>1</span><p>Conseguí tu PIN con el club.</p></div>
          <div className="how-step"><span>2</span><p>Ingresalo arriba desde tu celu, compu o TV.</p></div>
          <div className="how-step"><span>3</span><p>Mirá el partido en vivo y en pantalla completa.</p></div>
        </section>
      </main>

      <footer className="footer">
        <img src="/logo.png" alt="" className="footer-logo" />
        <span>CSD Soler TV · Transmisión de prueba · Próximamente pago online</span>
      </footer>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = { live: ["EN VIVO", "b-live"], upcoming: ["PROGRAMADO", "b-up"], ended: ["FINALIZADO", "b-end"] };
  const [txt, cls] = map[status] || [status, "b-up"];
  return <span className={`badge ${cls}`}>{txt}</span>;
}
