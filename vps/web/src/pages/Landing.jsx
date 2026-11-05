import Header, { LiveBadge } from "../components/Header";
import { fmtDate } from "../api";
import { useCurrentMatch } from "../match";

function TicketIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4V8Z" />
      <path d="M13 6v2m0 3v0m0 3v2" strokeLinecap="round" />
    </svg>
  );
}
function ScreenIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M9 20h6m-3-4v4" strokeLinecap="round" />
    </svg>
  );
}
function PlayIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M10.5 9.5v5l4.5-2.5-4.5-2.5Z" fill="currentColor" stroke="none" />
    </svg>
  );
}

export default function Landing({ onNav }) {
  const { match, error } = useCurrentMatch();
  const title = match ? match.title : "CSD Soler vs Rival a definir";
  const date = match ? fmtDate(match.starts_at) : "";

  function goVivo(ev) {
    if (ev) ev.preventDefault();
    onNav("/vivo");
  }

  return (
    <div>
      <Header variant="landing" onNav={onNav} />
      <main className="container container--pad">
        <section className="hero">
          <div className="live-row">
            <LiveBadge />
            {date ? <span className="date-muted">{date}</span> : null}
          </div>
          <h1>{title}</h1>
          <p className="hero-sub">Partidos en vivo del club</p>
          <a className="cta" href="/vivo" onClick={goVivo}>
            ▶ Ver el partido
          </a>
          <a className="preview" href="/vivo" onClick={goVivo} aria-label="Ver el partido en vivo">
            <span className="preview__badge">
              <LiveBadge />
            </span>
            <span className="preview__play" aria-hidden="true">
              ▶
            </span>
          </a>
        </section>

        {error && <div className="alert">{error}</div>}

        <section className="steps-sec" aria-labelledby="how-title">
          <h2 id="how-title">Cómo ver el partido</h2>
          <div className="steps">
            <div className="step">
              <span className="step__num" aria-hidden="true">1</span>
              <div className="step__body">
                <TicketIcon />
                <p>Conseguí tu acceso con el club.</p>
              </div>
            </div>
            <div className="step">
              <span className="step__num" aria-hidden="true">2</span>
              <div className="step__body">
                <ScreenIcon />
                <p>Ingresá desde tu celu, compu o TV.</p>
              </div>
            </div>
            <div className="step">
              <span className="step__num" aria-hidden="true">3</span>
              <div className="step__body">
                <PlayIcon />
                <p>Mirá el partido en vivo y en pantalla completa.</p>
              </div>
            </div>
          </div>
        </section>
      </main>
      <footer className="footer">CSD Soler TV · Transmisión oficial del club</footer>
    </div>
  );
}
