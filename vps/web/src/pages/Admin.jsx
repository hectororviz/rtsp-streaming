import { useEffect, useState } from "react";
import { api, fmtDate } from "../api";
import Player from "../Player";
import { useBrand } from "../settings";

const LS_KEY = "soler_admin_token";

function toLocalInput(iso) {
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
function fromLocalInput(v) {
  return new Date(v).toISOString();
}
function randomPin() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export default function Admin() {
  const { brand, refresh: refreshBrand } = useBrand();
  const [token, setToken] = useState(localStorage.getItem(LS_KEY) || "");
  const [authed, setAuthed] = useState(false);
  const [tab, setTab] = useState("partidos");
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null);
  const [previewKey, setPreviewKey] = useState("");

  async function login(ev) {
    ev?.preventDefault();
    setError("");
    try {
      const list = await api.adminList(token.trim());
      setItems(list);
      localStorage.setItem(LS_KEY, token.trim());
      setAuthed(true);
    } catch {
      setError("Token inválido.");
    }
  }

  async function refresh() {
    try {
      setItems(await api.adminList(token.trim()));
    } catch {
      setError("Sesión vencida, ingresá el token de nuevo.");
      setAuthed(false);
    }
  }

  useEffect(() => {
    if (token) login();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function regeneratePin(id) {
    setError("");
    try {
      await api.adminUpdate(token.trim(), id, { pin: randomPin() });
      refresh();
    } catch (e) {
      setError(e.message);
    }
  }

  async function save(ev) {
    ev.preventDefault();
    setError("");
    const fd = new FormData(ev.target);
    const data = {
      title: fd.get("title") || undefined,
      rival: fd.get("rival"),
      starts_at: fromLocalInput(fd.get("starts_at")),
      ends_at: fromLocalInput(fd.get("ends_at")),
      stream_key: fd.get("stream_key"),
    };
    const pin = (fd.get("pin") || "").trim();
    if (pin) data.pin = pin;
    // Sin PIN al crear: el servidor genera uno automáticamente.
    try {
      if (editing?.id) await api.adminUpdate(token.trim(), editing.id, data);
      else await api.adminCreate(token.trim(), data);
      setEditing(null);
      ev.target.reset();
      refresh();
    } catch (e) {
      setError(e.message);
    }
  }

  if (!authed) {
    return (
      <div className="wrap narrow">
        <div className="admin-topbar">
          <a href="/">← Volver al sitio</a>
        </div>
        <h1>Backoffice</h1>
        <form className="pin-card" onSubmit={login}>
          <h2>Token de administrador</h2>
          <div className="pin-row">
            <input className="input--token" type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="ADMIN_TOKEN" autoComplete="off" aria-label="Token de administrador" />
            <button className="btn btn--red" type="submit">Entrar</button>
          </div>
          {error && <div className="field-error">{error}</div>}
        </form>
      </div>
    );
  }

  return (
    <div className="wrap wide">
      <div className="admin-topbar">
        <a href="/">← Volver al sitio</a>
      </div>
      <div className="admin-head">
        <h1>Configuración</h1>
        <button className="linklike" onClick={() => { localStorage.removeItem(LS_KEY); setAuthed(false); setToken(""); }}>
          Salir
        </button>
      </div>
      {error && <div className="alert">{error}</div>}

      <div className="admin-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "partidos"}
          className={tab === "partidos" ? "admin-tab admin-tab--active" : "admin-tab"}
          onClick={() => setTab("partidos")}
        >
          Partidos
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "personalizacion"}
          className={tab === "personalizacion" ? "admin-tab admin-tab--active" : "admin-tab"}
          onClick={() => setTab("personalizacion")}
        >
          Personalización
        </button>
      </div>

      {tab === "partidos" ? (
        <>
          <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr><th>Partido</th><th>Inicio</th><th>Fin</th><th>Key</th><th>PIN</th><th>Estado</th><th></th></tr>
            </thead>
            <tbody>
              {items.map((m) => (
                <tr key={m.id}>
                  <td>{m.title} <small>vs {m.rival}</small></td>
                  <td>{fmtDate(m.starts_at)}</td>
                  <td>{fmtDate(m.ends_at)}</td>
                  <td><code>{m.stream_key}</code></td>
                  <td><code className="pin-code">{m.pin || "—"}</code></td>
                  <td>{m.status}</td>
                  <td className="row-actions">
                    <button className="btn btn--ghost btn--sm" onClick={() => setEditing(m)}>Editar</button>
                    <button className="btn btn--ghost btn--sm" onClick={() => regeneratePin(m.id)}>Regenerar PIN</button>
                    <button className="btn btn--ghost btn--sm" onClick={() => setPreviewKey(m.stream_key)}>Preview</button>
                    <button className="btn btn--danger btn--sm" onClick={async () => { if (confirm("¿Eliminar?")) { await api.adminDelete(token.trim(), m.id); refresh(); } }}>
                      Borrar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>

          <h2>{editing ? `Editar #${editing.id}` : "Nueva fecha"}</h2>
          <form className="form-grid" onSubmit={save} key={editing?.id || "new"}>
            <label>Título<input name="title" defaultValue={editing?.title || ""} placeholder={`${brand.site_name} vs …`} /></label>
            <label>Rival*<input name="rival" required defaultValue={editing?.rival || ""} /></label>
            <label>Inicio*<input name="starts_at" type="datetime-local" required defaultValue={editing ? toLocalInput(editing.starts_at) : ""} /></label>
            <label>Fin*<input name="ends_at" type="datetime-local" required defaultValue={editing ? toLocalInput(editing.ends_at) : ""} /></label>
            <label>Stream key*<input name="stream_key" required defaultValue={editing?.stream_key || "test"} /></label>
            <label>PIN {editing ? `(actual: ${editing.pin || "—"})` : "(vacío = auto)"}<input name="pin" type="text" autoComplete="off" placeholder="6 dígitos" /></label>
            <div className="form-actions">
              <button className="btn btn--red" type="submit">Guardar</button>
              {editing && <button type="button" className="linklike" onClick={() => setEditing(null)}>Cancelar</button>}
            </div>
          </form>
          <p className="muted">El PIN se genera solo al crear la fecha y es válido por ese día. Compartilo por los canales del club.</p>

          {previewKey && (
            <div>
              <h2>Preview (requiere PIN del partido en otra pestaña)</h2>
              <p className="muted">La preview usa el HLS público del path <code>live/{previewKey}</code>: sirve para verificar que el puente está publicando.</p>
              <PreviewPlayer streamKey={previewKey} />
            </div>
          )}
        </>
      ) : (
        <BrandingForm token={token} onSaved={refreshBrand} onError={setError} />
      )}
    </div>
  );
}

function BrandingForm({ token, onSaved, onError }) {
  const { brand } = useBrand();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [ok, setOk] = useState("");

  useEffect(() => {
    let alive = true;
    api.adminGetSettings(token.trim()).then((s) => alive && setForm(s)).catch(() => alive && setForm({ ...brand }));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!form) return <p className="muted">Cargando…</p>;

  function set(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
    setOk("");
  }

  function onShieldFile(ev) {
    const file = ev.target.files?.[0];
    if (!file) return;
    if (!/^image\/(png|jpeg|webp|svg\+xml)$/.test(file.type)) {
      onError("El escudo debe ser PNG, JPG, WebP o SVG.");
      return;
    }
    if (file.size > 512 * 1024) {
      onError("El escudo es muy pesado (máx 512KB).");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => set("shield", reader.result);
    reader.readAsDataURL(file);
  }

  async function save(ev) {
    ev.preventDefault();
    setSaving(true);
    setOk("");
    try {
      const next = await api.adminUpdateSettings(token.trim(), {
        site_name: form.site_name,
        tagline: form.tagline,
        shield: form.shield,
        color_primary: form.color_primary,
        color_secondary: form.color_secondary,
      });
      await onSaved();
      setForm(next);
      setOk("Personalización guardada.");
    } catch (e) {
      onError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="brand-form" onSubmit={save}>
      <h2>Personalización del sitio</h2>
      <div className="brand-form__grid">
        <label>Nombre del sitio*<input value={form.site_name || ""} onChange={(e) => set("site_name", e.target.value)} maxLength={60} required /></label>
        <label>Descripción<input value={form.tagline || ""} onChange={(e) => set("tagline", e.target.value)} maxLength={120} placeholder="Partidos en vivo del club" /></label>
        <label>Color principal*<input type="color" value={form.color_primary || "#c4161c"} onChange={(e) => set("color_primary", e.target.value)} /></label>
        <label>Color secundario*<input type="color" value={form.color_secondary || "#0a8f3c"} onChange={(e) => set("color_secondary", e.target.value)} /></label>
      </div>
      <div className="shield-row">
        <div className="shield-preview">
          {form.shield ? <img src={form.shield} alt="Escudo actual" /> : <span className="muted">Sin escudo</span>}
        </div>
        <div className="shield-actions">
          <label className="btn btn--ghost">
            Subir escudo
            <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={onShieldFile} hidden />
          </label>
          {form.shield && <button type="button" className="linklike" onClick={() => set("shield", null)}>Quitar</button>}
          <p className="muted">PNG, JPG, WebP o SVG · máx 512KB.</p>
        </div>
      </div>
      <div className="form-actions">
        <button className="btn btn--red" type="submit" disabled={saving}>{saving ? "Guardando…" : "Guardar"}</button>
        {ok && <span className="save-ok">{ok}</span>}
      </div>
    </form>
  );
}

function PreviewPlayer({ streamKey }) {
  // Preview directa del path HLS: verifica que el puente este publicando.
  const src = `https://hls.streaming.csdsoler.com.ar/live/${streamKey}/index.m3u8`;
  return <Player src={src} />;
}
