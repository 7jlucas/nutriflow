"use client";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Magnetic } from "@/components/ui/magnetic";
import { Logo } from "@/components/brand/logo";
import { TACO_CITATION } from "@/lib/nutrition/taco-samples";
import { RevealTitle, SectionIndex } from "./reveal";
import { MorphMark } from "./morph-mark";

export function SectionCta() {
  return (
    <section className="relative overflow-hidden border-t border-line py-28 md:py-44" aria-labelledby="cta-title">
      <div className="pointer-events-none absolute -right-24 top-1/2 hidden h-[560px] w-[560px] -translate-y-1/2 lg:block xl:right-10">
        <MorphMark />
      </div>
      <div className="relative mx-auto max-w-[1440px] px-5 md:px-10">
        <SectionIndex n="05" label="Comece" />
        <RevealTitle id="cta-title" className="mt-6 text-[clamp(3.4rem,12vw,13rem)]">
          Start with
          <br />
          what you <span className="text-volt">eat.</span>
        </RevealTitle>
        <div className="mt-12 flex flex-wrap items-center gap-6">
          <Magnetic>
            <Link href="/signup" className="btn btn-volt h-14 px-8 text-sm">
              Criar minha conta <ArrowUpRight size={18} aria-hidden />
            </Link>
          </Magnetic>
          <p className="max-w-[40ch] text-sm text-mute">
            Cadastro com e-mail e senha. Seus dados são seus: exporte ou exclua a conta quando quiser.
          </p>
        </div>
      </div>
    </section>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto grid max-w-[1440px] gap-10 px-5 py-14 md:grid-cols-12 md:px-10">
        <div className="md:col-span-4">
          <Logo />
          <p className="mt-4 max-w-[36ch] text-sm text-mute">Your body. Your data. Your evolution.</p>
        </div>
        <div className="text-sm text-mute md:col-span-5">
          <div className="eyebrow text-bone">Fontes e limites</div>
          <p className="mt-3 leading-relaxed">
            Dados de composição: {TACO_CITATION}. Gasto energético estimado pela equação de Mifflin-St Jeor. As estimativas
            podem variar individualmente. O NUTRI//FLOW não substitui acompanhamento com nutricionista ou médico.
          </p>
        </div>
        <nav aria-label="Rodapé" className="flex flex-col gap-2 text-sm md:col-span-3">
          <div className="eyebrow text-bone">Conta</div>
          <Link href="/signup" className="text-mute hover:text-bone">Criar conta</Link>
          <Link href="/login" className="text-mute hover:text-bone">Entrar</Link>
          <Link href="/privacidade" className="text-mute hover:text-bone">Privacidade e LGPD</Link>
        </nav>
      </div>
    </footer>
  );
}
