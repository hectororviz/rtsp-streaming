import { useState } from "react";

// Caja de acceso: hoy PIN temporal, mañana checkout. Misma lógica, mismos tokens.
export default function PinForm({ matchId, busy, onSubmit }) {
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");

  async function handle(ev) {
    ev.preventDefault();
    if (!pin.trim()) return;
    setPinError("");
    try {
      await onSubmit(pin.trim());
      setPin("");
    } catch {
      setPinError("PIN incorrecto. Revisalo e intentá de nuevo.");
    }
  }

  if (!matchId) return null;
  return (
    <form className="pin-card" onSubmit={handle}>
      <h2>Ingresá tu acceso</h2>
      <p>Te lo dio el club para esta transmisión.</p>
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
        />
        <button className="btn btn--red" type="submit" disabled={busy || !pin.trim()}>
          {busy ? "..." : "Ver partido"}
        </button>
      </div>
      {pinError && <div className="field-error">{pinError}</div>}
    </form>
  );
}
