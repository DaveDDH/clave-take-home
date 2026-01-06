"use client";

import Image from "next/image";

import { ThemeToggle } from "./ThemeToggle";
import { useThemeStore } from "@/stores/theme-store";

export function Header() {
  const theme = useThemeStore((state) => state.theme);

  const logoSrc =
    theme === "dark" ? "/clave-logo_darkmode.webp" : "/clave-logo.webp";

  return (
    <header className="flex h-11 w-full border-b border-border bg-car px-4 justify-between items-center shrink-0">
      <Image
        src={logoSrc}
        alt="Clave"
        width={90}
        height={10}
        priority
        style={{ width: "auto", height: "60%" }}
      />

      <ThemeToggle />
    </header>
  );
}
