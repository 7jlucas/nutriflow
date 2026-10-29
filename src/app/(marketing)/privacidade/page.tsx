import type { Metadata } from "next";
import { Logo } from "@/components/brand/logo";

export const metadata: Metadata = { title: "Privacidade e LGPD" };

export default function PrivacyPage() {
  return (
    <main id="conteudo" className="mx-auto max-w-3xl px-5 py-16 md:py-24">
      <Logo />
      <h1 className="display mt-12 text-6xl md:text-8xl">Privacidade</h1>
      <div className="mt-10 space-y-6 leading-relaxed text-mute [&_h2]:mt-10 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-bone">
        <p>
          O NUTRI//FLOW trata dados pessoais para uma finalidade: permitir que você acompanhe sua alimentação, metas e
          evolução. Coletamos apenas o necessário para os cálculos e funcionalidades que você usa.
        </p>
        <h2>Quais dados</h2>
        <p>
          E-mail e senha (gerenciados pelo serviço de autenticação, a senha nunca é armazenada em texto). Perfil
          nutricional (idade, altura, sexo para a equação, nível de atividade, objetivo, preferências, alergias e
          restrições). Registros que você cria: diário alimentar, pesagens, medidas, água, planos e conversas com o
          assistente.
        </p>
        <h2>Dados sensíveis</h2>
        <p>
          Informações de saúde são dados sensíveis segundo a LGPD (art. 11). Elas são usadas exclusivamente para
          personalizar sua experiência a seu pedido, ficam isoladas por usuário com políticas de acesso no banco de dados
          (Row Level Security) e não são compartilhadas para publicidade.
        </p>
        <h2>Assistente de IA</h2>
        <p>
          Quando você usa o AI Nutrition Lab, enviamos ao provedor de IA configurado apenas o necessário para a resposta
          (seu objetivo, meta calórica, restrições e a mensagem). Não enviamos e-mail nem nome.
        </p>
        <h2>Seus direitos</h2>
        <p>
          Você pode editar seus dados a qualquer momento, exportar relatórios (CSV/PDF) e excluir sua conta em
          Configurações. A exclusão remove permanentemente todos os seus registros.
        </p>
      </div>
    </main>
  );
}
