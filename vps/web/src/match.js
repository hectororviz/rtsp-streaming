import { useEffect, useState } from "react";
import { api } from "./api";

// Única fuente de datos del partido: endpoint /api/matches/current.
// Ningún componente hardcodea título, fecha ni URL HLS.
export function useCurrentMatch() {
  const [match, setMatch] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    api
      .current()
      .then((m) => alive && setMatch(m))
      .catch(() => alive && setError("No hay partidos cargados todavía."))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  return { match, setMatch, error, loading };
}

export async function loadStreamUrl(matchId) {
  const s = await api.stream(matchId);
  return s.hlsUrl;
}
