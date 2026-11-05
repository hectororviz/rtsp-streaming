import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";

// Reproductor 16:9 con escudo en esquina y fullscreen sobre el contenedor
// (asi el logo queda visible tambien en pantalla completa).
export default function Player({ src }) {
  const wrapRef = useRef(null);
  const videoRef = useRef(null);
  const [error, setError] = useState("");
  const [isFs, setIsFs] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;
    setError("");
    let hls = null;
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
      video.play().catch(() => {});
    } else if (Hls.isSupported()) {
      hls = new Hls({ maxBufferLength: 20 });
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => video.play().catch(() => {}));
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (data.fatal) setError("Se cortó la transmisión. Recargá la página.");
      });
    } else {
      setError("Tu navegador no soporta HLS.");
    }
    return () => hls && hls.destroy();
  }, [src]);

  useEffect(() => {
    const onFs = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const toggleFs = () => {
    const el = wrapRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else el.requestFullscreen().catch(() => setError("No se pudo entrar en pantalla completa."));
  };

  if (!src) return null;
  return (
    <div className="player" ref={wrapRef}>
      <video ref={videoRef} controls playsInline preload="auto" />
      <img src="/logo.png" alt="CSD Soler" className="player-badge" draggable={false} />
      {error ? (
        <div className="player-error">{error}</div>
      ) : (
        <button className="player-fs" onClick={toggleFs} title="Pantalla completa">
          {isFs ? "⤢ Salir" : "⛶ Completa"}
        </button>
      )}
    </div>
  );
}
