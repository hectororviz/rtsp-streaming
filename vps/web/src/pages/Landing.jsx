import { useState } from "react";
import Header, { LiveBadge } from "../components/Header";
import AccessModal from "../components/AccessModal";
import { api, fmtDate } from "../api";
import { useCurrentMatch } from "../match";
import { useBrand } from "../settings";

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
  const { brand } = useBrand();
  const { match, error } = useCurrentMatch();
  const [modalOpen, setModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const title = match ? match.title : `${brand.site_name} vs Rival a definir`;
  const date = match ? fmtDate(match.starts_at) : "";

  function openAccess(ev) {
    if (ev) ev.preventDefault();
    if (match) setModalOpen(true);
    else onNav("/vivo");
  }

  async function submitPin(pin) {
    if (!match || busy) return;
    setBusy(true);
    try {
      await api.access(match.id, pin);
      setModalOpen(false);
      onNav("/vivo");
    } finally {
      setBusy(false);
    }
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
          <p className="hero-sub">{brand.tagline}</p>

          {match ? (
            <div className="match-card">
              <div className="match-card__info">
                <span className="match-card__rival">vs {match.rival}</span>
                <span className="date-muted">{date}</span>
              </div>
              <button className="cta" type="button" onClick={openAccess}>
                ▶ Ver en vivo
              </button>
            </div>
          ) : (
            <button className="cta" type="button" onClick={openAccess} disabled={!match && !error}>
              ▶ Ver en vivo
            </button>
          )}

          <button
            className="preview preview--field"
            type="button"
            onClick={openAccess}
            aria-label="Ver el partido en vivo"
          >
            <span className="preview__badge">
              <LiveBadge />
            </span>
            <span className="preview__play" aria-hidden="true">
              ▶
            </span>
          </button>
        </section>

        {error && <div className="alert">{error}</div>}

        <section className="info-sec" aria-labelledby="info-title">
          <h2 id="info-title">La transmisión oficial del club</h2>
          <p>
            Mirá los partidos en vivo desde donde estés: tu celu, tu compu o tu TV.
            El acceso se habilita para el día del partido, con tu PIN o con tu compra.
          </p>
        </section>

        <section className="steps-sec" aria-labelledby="how-title">
          <h2 id="how-title">Cómo ver el partido</h2>
          <div className="steps">
            <div className="step">
              <span className="step__num" aria-hidden="true">1</span>
              <div className="step__body">
                <TicketIcon />
                <p>Conseguí tu acceso con el club: PIN o compra del día.</p>
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

        <section className="info-sec" aria-labelledby="faq-title">
          <h2 id="faq-title">Preguntas frecuentes</h2>
          <div className="faq">
            <details>
              <summary>¿Cuánto dura mi acceso?</summary>
              <p>El acceso (PIN o compra) es válido por el día del partido.</p>
            </details>
            <details>
              <summary>¿Dónde consigo mi PIN?</summary>
              <p>El club genera un PIN por fecha y te lo comparte por sus canales.</p>
            </details>
            <details>
              <summary>¿Puedo verlo en el televisor?</summary>
              <p>Sí: abrí el sitio en el navegador de tu Smart TV y usá pantalla completa.</p>
            </details>
          </div>
        </section>
      </main>
      <footer className="footer">{brand.site_name} · Transmisión oficial del club</footer>

      {modalOpen && match && (
        <AccessModal match={match} busy={busy} onSubmit={submitPin} onClose={() => setModalOpen(false)} />
      )}
    </div>
  );
}
