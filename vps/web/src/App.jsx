import { useEffect, useState } from "react";
import Home from "./pages/Home";
import Admin from "./pages/Admin";
import "./styles.css";

function currentRoute() {
  return window.location.hash.replace(/^#/, "") || "/";
}

export default function App() {
  const [route, setRoute] = useState(currentRoute);
  useEffect(() => {
    const onH = () => setRoute(currentRoute());
    window.addEventListener("hashchange", onH);
    return () => window.removeEventListener("hashchange", onH);
  }, []);
  if (route.startsWith("/admin")) return <Admin />;
  return <Home />;
}
