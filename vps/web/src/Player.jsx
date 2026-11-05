import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import Hls from "hls.js";

// Contenedor visual + lógica HLS existente (lowLatency + fallback Safari).
// Sin escudo superpuesto: lo agrega el servidor en el stream.
const Player = forwardRef(function Player({ src, reloadKey = 0, waitingText }, ref) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const [error, setError] = useState("");

  useImperativeHandle(ref, () => ({
    get video() {
      return videoRef.current;
    },
  }));

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;
    setError("");
    let hls = null;

    // Limpieza previa
    try {
      video.pause();
    } catch {}
    if (hlsRef.current) {
      try {
        hlsRef.current.destroy();
      } catch {}
      hlsRef.current = null;
    }

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
      video.play().catch(() => {});
    } else if (Hls.isSupported()) {
      hls = new Hls({ lowLatencyMode: true, maxBufferLength: 20 });
      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => video.play().catch(() => {}));
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (data.fatal) setError("No pudimos cargar la señal.");
      });
    } else {
      setError("Tu navegador no soporta HLS.");
    }

    return () => {
      try {
        video.pause();
      } catch {}
      if (hls) {
        try {
          hls.destroy();
        } catch {}
      }
      if (hlsRef.current === hls) hlsRef.current = null;
    };
  }, [src, reloadKey]);

  if (!src && !waitingText) return null;

  return (
    <div className="player">
      {src ? (
        <video ref={videoRef} controls playsInline autoPlay muted preload="auto" />
      ) : (
        <div className="player-overlay">
          <h2>Acá va la señal en vivo</h2>
          {waitingText ? <p>{waitingText}</p> : null}
        </div>
      )}
      {error && src ? (
        <div className="player-overlay" role="alert">
          <h2>No pudimos cargar la señal</h2>
          <p>Probá recargar la señal. Si sigue sin andar, volvé en unos minutos.</p>
        </div>
      ) : null}
    </div>
  );
});

export default Player;
