"use client";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    let stored: string | null = null;
    try { stored = localStorage.getItem("aqe-theme"); } catch { /* Almacenamiento opcional. */ }
    const next = stored ? stored === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.classList.toggle("dark", next);
    setDark(next);
  }, []);
  function toggle() {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    setDark(next);
    try { localStorage.setItem("aqe-theme", next ? "dark" : "light"); } catch { /* El tema sigue funcionando sin persistencia. */ }
  }
  return <Button variant="ghost" size="icon" onClick={toggle} aria-label={dark ? "Activar modo claro" : "Activar modo oscuro"} title={dark ? "Modo claro" : "Modo oscuro"}>{dark ? <Sun /> : <Moon />}</Button>;
}
