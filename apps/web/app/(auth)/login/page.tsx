import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams
}: {
  searchParams?: Promise<{ created?: string; senha?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  const successMessage =
    params.senha === "alterada"
      ? "Senha alterada. Entre com a nova senha."
      : params.created === "1"
        ? "Conta criada. Entre com seu e-mail e senha."
        : null;

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-6 py-12 text-zinc-950">
      <section className="w-full max-w-sm">
        <div className="mb-8">
          <p className="text-sm font-medium text-emerald-700">Copiloto Jurídico</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-normal">
            Entre no painel
          </h1>
          <p className="mt-3 text-sm leading-6 text-zinc-600">
            Acesse os atendimentos, diagnósticos e equipe da sua organização.
          </p>
        </div>
        {successMessage ? (
          <p className="mb-5 rounded border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-800">
            {successMessage}
          </p>
        ) : null}
        <LoginForm />
      </section>
    </main>
  );
}
