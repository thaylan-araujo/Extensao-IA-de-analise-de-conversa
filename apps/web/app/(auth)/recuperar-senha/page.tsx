import Link from "next/link";

import { RequestPasswordResetForm } from "./request-form";

export default async function RecuperarSenhaPage({
  searchParams
}: {
  searchParams?: Promise<{ erro?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  const hasInvalidLink = params.erro === "link-invalido";

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-6 py-12 text-zinc-950">
      <section className="w-full max-w-sm">
        <div className="mb-8">
          <p className="text-sm font-medium text-emerald-700">Redefinir senha</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-normal">
            Peça um link seguro
          </h1>
          <p className="mt-3 text-sm leading-6 text-zinc-600">
            Informe seu e-mail para receber as instruções de redefinição.
          </p>
        </div>
        {hasInvalidLink ? (
          <p className="mb-5 rounded border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
            Link inválido ou expirado. Peça um novo link.
          </p>
        ) : null}
        <RequestPasswordResetForm />
        <Link className="mt-6 inline-flex text-sm font-medium text-emerald-700" href="/login">
          Voltar para o login
        </Link>
      </section>
    </main>
  );
}
