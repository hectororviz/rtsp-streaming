import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "./api";

// Personalización del sitio (nombre, escudo, colores).
// Fuente: GET /api/settings con fallback local si la API no responde.
export const DEFAULT_BRAND = {
  site_name: "CSD Soler TV",
  tagline: "Partidos en vivo del club",
  shield: null,
  color_primary: "#c4161c",
  color_secondary: "#0a8f3c",
};

const SettingsContext = createContext({ brand: DEFAULT_BRAND, refresh: async () => {} });

export function applyBrand(brand) {
  const b = { ...DEFAULT_BRAND, ...brand };
  const root = document.documentElement;
  root.style.setProperty("--brand", b.color_primary);
  root.style.setProperty("--brand2", b.color_secondary);
  // La marca tiñe el sistema existente: rojo = primario, verde = secundario.
  root.style.setProperty("--red", b.color_primary);
  root.style.setProperty("--grn", b.color_secondary);
  document.title = `${b.site_name} — Partidos en vivo`;
  const meta = document.querySelector('meta[name="description"]');
  if (meta) meta.setAttribute("content", `${b.site_name} — ${b.tagline}.`);
  let icon = document.querySelector('link[rel="icon"]');
  if (b.shield && !icon?.dataset?.brand) {
    icon = document.createElement("link");
    icon.rel = "icon";
    icon.dataset.brand = "1";
    document.head.appendChild(icon);
  }
  if (icon?.dataset?.brand && b.shield) icon.href = b.shield;
}

export function SettingsProvider({ children }) {
  const [brand, setBrand] = useState(DEFAULT_BRAND);

  const refresh = useCallback(async () => {
    try {
      const s = await api.settings();
      const next = { ...DEFAULT_BRAND, ...s };
      setBrand(next);
      applyBrand(next);
      return next;
    } catch {
      applyBrand(DEFAULT_BRAND);
      return DEFAULT_BRAND;
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return <SettingsContext.Provider value={{ brand, refresh }}>{children}</SettingsContext.Provider>;
}

export function useBrand() {
  return useContext(SettingsContext);
}
