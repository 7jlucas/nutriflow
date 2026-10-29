import { SiteHeader } from "@/components/landing/site-header";
import { Hero } from "@/components/landing/hero";
import { SectionConsume } from "@/components/landing/section-consume";
import { SectionSmarter } from "@/components/landing/section-smarter";
import { SectionEvolution } from "@/components/landing/section-evolution";
import { SectionPlan } from "@/components/landing/section-plan";
import { SectionCta, SiteFooter } from "@/components/landing/section-cta";

export default function LandingPage() {
  return (
    <>
      <SiteHeader />
      <main id="conteudo">
        <Hero />
        <SectionConsume />
        <SectionSmarter />
        <SectionEvolution />
        <SectionPlan />
        <SectionCta />
      </main>
      <SiteFooter />
    </>
  );
}
