export default function Loading() {
  return (
    <div className="mx-auto max-w-[1280px] px-5 py-8 md:px-10" aria-busy aria-label="Carregando">
      <div className="skeleton h-4 w-40" />
      <div className="skeleton mt-4 h-14 w-2/3" />
      <div className="mt-10 grid gap-3 md:grid-cols-3">
        <div className="skeleton h-72 md:col-span-2" />
        <div className="skeleton h-72" />
      </div>
      <div className="skeleton mt-3 h-56" />
    </div>
  );
}
