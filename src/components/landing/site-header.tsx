"use client";
import Link from "next/link";
import { motion, useMotionValueEvent, useScroll } from "motion/react";
import { useState } from "react";
import { Logo } from "@/components/brand/logo";

const NAV = [
  { href: "#consume", label: "Diário" },
  { href: "#smarter", label: "Alimentos" },
  { href: "#evolution", label: "Evolução" },
  { href: "#plan", label: "Planos & IA" },
];

export function SiteHeader() {
  const { scrollY } = useScroll();
  const [solid, setSolid] = useState(false);
  const [hidden, setHidden] = useState(false);
  useMotionValueEvent(scrollY, "change", (y) => {
    const prev = scrollY.getPrevious() ?? 0;
    setSolid(y > 24);
    // esconde ao rolar para baixo (libera a leitura), mostra ao subir
    setHidden(y > 400 && y > prev);
  });

  return (
    <motion.header
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: hidden ? -80 : 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className={`fixed inset-x-0 top-0 z-50 border-b transition-colors duration-300 ${
        solid ? "border-line bg-ink/85 backdrop-blur-md" : "border-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-5 md:px-10">
        <Logo />
        <nav aria-label="Seções" className="hidden items-center gap-8 lg:flex">
          {NAV.map((n) => (
            <a key={n.href} href={n.href} className="eyebrow transition-colors hover:text-bone">
              {n.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/login" className="btn btn-quiet btn-sm">
            Entrar
          </Link>
          <Link href="/signup" className="btn btn-volt btn-sm hidden sm:inline-flex">
            Começar agora
          </Link>
        </div>
      </div>
    </motion.header>
  );
}
