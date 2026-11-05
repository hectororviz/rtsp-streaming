import { useEffect, useState } from "react";
import { api, fmtDate } from "../api";

// Modal de acceso al partido: PIN funcional, Mercado Pago pendiente.
// El acceso (PIN o compra) es válido por el día del partido.
export default function AccessModal({ match, busy, onSubmit, onClose }) {
  const [tab, setTab] = useState("pin");
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");

  useEffect(() => {
    function onKey(ev) {
      if (ev.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  async function handlePin(ev) {
    ev.preventDefault();
    if (!pin.trim()) return;
    setPinError("");
    try {
      await onSubmit(pin.trim());
    } catch {
      setPinError("PIN incorrecto. Revisalo e intentá de nuevo.");
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Acceso al partido"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <h2>{match ? match.title : "Ver en vivo"}</h2>
            {match && <p className="muted">{fmtDate(match.starts_at)}</p>}
          </div>
          <button className="modal-close" type="button" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </div>

        <div className="modal-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "pin"}
            className={tab === "pin" ? "modal-tab modal-tab--active" : "modal-tab"}
            onClick={() => setTab("pin")}
          >
            Tengo mi PIN
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "mp"}
            className={tab === "mp" ? "modal-tab modal-tab--active" : "modal-tab"}
            onClick={() => setTab("mp")}
          >
            Pagar con Mercado Pago
          </button>
        </div>

        {tab === "pin" ? (
          <form onSubmit={handlePin}>
            <p className="muted">Te lo dio el club para esta transmisión.</p>
            <div className="pin-row">
              <input
                type="password"
                inputMode="numeric"
                autoComplete="off"
                placeholder="PIN"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                maxLength={32}
                aria-label="PIN de acceso"
                autoFocus
              />
              <button className="btn btn--red" type="submit" disabled={busy || !pin.trim()}>
                {busy ? "..." : "Ver partido"}
              </button>
            </div>
            {pinError && <div className="field-error">{pinError}</div>}
          </form>
        ) : (
          <div>
            <p className="muted">El pago online todavía no está habilitado.</p>
            <div className="alert">Muy pronto vas a poder pagar tu acceso por acá con Mercado Pago.</div>
          </div>
        )}

        <p className="modal-validity">El acceso (PIN o compra) es válido por el día del partido.</p>
      </div>
    </div>
  );
}
