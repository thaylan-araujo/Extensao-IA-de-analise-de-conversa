import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-50">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <p className="text-sm font-medium uppercase tracking-[0.16em] text-emerald-300">
          Copiloto Juridico WhatsApp
        </p>
        <h1 className="text-4xl font-semibold tracking-normal">
          Painel de gestao em construcao
        </h1>
        <p className="max-w-2xl text-lg leading-8 text-slate-300">
          O esqueleto do app web esta pronto para receber o fluxo de login,
          leitura de organizacao e controle de equipe nas proximas etapas.
        </p>
        <Link
          className="w-fit rounded bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950"
          href="/login"
        >
          Ir para login
        </Link>
      </div>
    </main>
  );
}
