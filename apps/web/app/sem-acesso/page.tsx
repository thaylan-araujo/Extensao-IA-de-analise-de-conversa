export default function SemAcessoPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-6 py-12 text-zinc-950">
      <section className="w-full max-w-lg rounded border border-zinc-200 bg-white p-8">
        <p className="text-sm font-medium text-emerald-700">Acesso restrito</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-normal">
          Este painel é exclusivo para gestor.
        </h1>
        <p className="mt-4 text-sm leading-6 text-zinc-600">
          Seu perfil de advogado usa a extensão no WhatsApp Web. O painel web fica
          reservado para o gestor acompanhar equipe, notas e diagnósticos.
        </p>
        <form action="/auth/signout" className="mt-6" method="post">
          <button
            className="rounded bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800"
            type="submit"
          >
            Sair
          </button>
        </form>
      </section>
    </main>
  );
}
