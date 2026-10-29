import Link from "next/link";

export default function NotFound() {
  return (
    <main id="conteudo" className="grid min-h-dvh place-items-center px-5">
      <div>
        <div className="eyebrow">Erro 404</div>
        <h1 className="display mt-4 text-[clamp(4rem,14vw,12rem)]">Off track.</h1>
        <p className="mt-4 text-mute">Esta página não existe ou foi movida.</p>
        <Link href="/" className="btn btn-volt mt-8">Voltar ao início</Link>
      </div>
    </main>
  );
}
