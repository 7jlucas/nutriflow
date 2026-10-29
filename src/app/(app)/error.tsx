"use client";
import { RefreshCw } from "lucide-react";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-xl px-5 py-24">
      <div className="eyebrow text-danger">Erro</div>
      <h1 className="display mt-3 text-6xl">Signal lost.</h1>
      <p className="mt-4 text-mute">Não conseguimos carregar esta tela. Verifique sua conexão e tente novamente. Seus registros salvos não foram afetados.</p>
      <button onClick={reset} className="btn btn-volt mt-8">
        <RefreshCw size={16} /> Tentar novamente
      </button>
    </div>
  );
}
