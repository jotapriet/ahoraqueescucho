import type { Metadata } from "next";
import { Fraunces, JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import "./globals.css";

const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", display: "swap" });
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta", display: "swap" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains", display: "swap" });

export const metadata: Metadata = {
  title: "Ahora qué escucho",
  description: "Álbumes completos recomendados por personas, para tu momento.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" data-scroll-behavior="smooth" className={`${fraunces.variable} ${jakarta.variable} ${jetbrains.variable}`}>
      <body>
        <a href="#main-content" className="sr-only z-50 rounded bg-background p-3 focus:not-sr-only focus:absolute focus:left-4 focus:top-4">Saltar al contenido</a>
        <SiteHeader />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
