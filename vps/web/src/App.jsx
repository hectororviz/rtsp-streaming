import { useCallback, useEffect, useState } from "react";
import Landing from "./pages/Landing";
import Vivo from "./pages/Vivo";
import Admin from "./pages/Admin";
import "./styles.css";

function pathNow() {
  // Compat: vieja hash-routing #/admin -> /admin
  if (window.location.hash.startsWith("#/")) {
    const p = window.location.hash.replace(/^#/, "");
    window.history.replaceState(null, "", p);
    return p;
  }
  return window.location.pathname || "/";
}

export function navigate(to) {
  if (window.location.pathname !== to) window.history.pushState(null, "", to);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export default function App() {
  const [route, setRoute] = useState(pathNow);

  useEffect(() => {
    const onPop = () => {
      setRoute(window.location.pathname || "/");
      window.scrollTo(0, 0);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const go = useCallback((to) => {
    navigate(to);
  }, []);

  // Alias /partido -> /vivo (canónica)
  if (route === "/partido" || route === "/partido/") {
    window.history.replaceState(null, "", "/vivo");
    return <Vivo onNav={go} />;
  }
  if (route.startsWith("/admin")) return <Admin />;
  if (route === "/vivo" || route === "/vivo/") return <Vivo onNav={go} />;
  return <Landing onNav={go} />;
}
