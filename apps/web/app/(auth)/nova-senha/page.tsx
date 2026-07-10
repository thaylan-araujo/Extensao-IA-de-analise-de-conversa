import Link from "next/link";

import { createClient } from "../../../lib/supabase/server";
import { PasswordForm } from "./password-form";

export default async function NovaSenhaPage() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-6 py-12 text-zinc-950">
        <section className="w-full max-w-sm rounded border border-zinc-200 bg-white p-8">
          <p className="text-sm font-medium text-red-700">Sessão necessária</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-normal">
            Peça um novo link
          </h1>
          <p className="mt-4 text-sm leading-6 text-zinc-600">
            Para definir uma nova senha, acesse o link enviado para seu e-mail.
          </p>
          <Link
            className="mt-6 inline-flex rounded bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800"
            href="/recuperar-senha"
          >
            Pedir link
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-6 py-12 text-zinc-950">
      <section className="w-full max-w-sm">
        <div className="mb-8">
          <p className="text-sm font-medium text-emerald-700">Nova senha</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-normal">
            Defina sua nova senha
          </h1>
          <p className="mt-3 text-sm leading-6 text-zinc-600">
            Use pelo menos 8 caracteres.
          </p>
        </div>
        <PasswordForm />
      </section>
    </main>
  );
}
