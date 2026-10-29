import type { Metadata, Viewport } from "next";
import { Archivo, Instrument_Sans } from "next/font/google";
import { MotionProvider } from "@/components/ui/motion-provider";
import "./globals.css";

const display = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-archivo",
  display: "swap",
});
const sans = Instrument_Sans({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-instrument",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "NUTRI//FLOW · Your body. Your data. Your evolution.", template: "%s · NUTRI//FLOW" },
  description:
    "Diário alimentar, contador de calorias com dados da TACO, planos alimentares e acompanhamento de peso em uma plataforma de performance nutricional.",
  applicationName: "NUTRI//FLOW",
};

export const viewport: Viewport = {
  themeColor: "#0A0A0A",
  colorScheme: "dark",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${display.variable} ${sans.variable}`} suppressHydrationWarning>
      <head>
        {/* marca que JS está ativo; animações de entrada só escondem conteúdo nesse caso */}
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js');setTimeout(function(){document.querySelectorAll('.hero-pre').forEach(function(e){e.style.visibility='visible'})},2500)" }} />
      </head>
      <body className="min-h-dvh">
        <a href="#conteudo" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] btn btn-volt">
          Pular para o conteúdo
        </a>
        <MotionProvider>{children}</MotionProvider>
      </body>
    </html>
  );
}
