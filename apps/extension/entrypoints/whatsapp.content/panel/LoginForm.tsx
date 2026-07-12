/**
 * Login dentro do próprio painel (AUTH-01, D-09) — analog direto de
 * apps/web/app/(auth)/login/login-form.tsx, adaptado para a extensão:
 * - supabase-js com adapter chrome.storage.local no lugar do @supabase/ssr
 * - sucesso troca o estado do painel (setSession) em vez de router.push
 * - "Esqueci minha senha" abre o fluxo web da Fase 1 em nova aba (contrato do UI-SPEC)
 * Copy travada: "Entrar" / "Entrando..." / "E-mail ou senha inválidos." /
 * "Esqueci minha senha".
 */
import { useState, type FormEvent } from "react";

import { supabase } from "../sync/supabase";
import { usePanel } from "./store";

export function LoginForm() {
  const { setSession, forgotPassword } = usePanel();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsLoading(true);

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError || !data.session) {
      setError("E-mail ou senha inválidos.");
      setIsLoading(false);
      return;
    }

    setSession(data.session);
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      <label className="flex flex-col gap-2 text-sm font-semibold text-zinc-800">
        E-mail
        <input
          className="h-11 rounded border border-zinc-300 bg-white px-3 text-base font-normal outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
          autoComplete="email"
          inputMode="email"
          name="email"
          onChange={(event) => setEmail(event.target.value)}
          required
          type="email"
          value={email}
        />
      </label>

      <label className="flex flex-col gap-2 text-sm font-semibold text-zinc-800">
        Senha
        <input
          className="h-11 rounded border border-zinc-300 bg-white px-3 text-base font-normal outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
          autoComplete="current-password"
          name="password"
          onChange={(event) => setPassword(event.target.value)}
          required
          type="password"
          value={password}
        />
      </label>

      {error ? <p className="text-sm font-semibold text-red-700">{error}</p> : null}

      <button
        className="h-11 rounded bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800 focus:ring-2 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-zinc-400"
        disabled={isLoading}
        type="submit"
      >
        {isLoading ? "Entrando..." : "Entrar"}
      </button>

      <button
        className="text-left text-sm font-semibold text-emerald-700"
        onClick={forgotPassword}
        type="button"
      >
        Esqueci minha senha
      </button>
    </form>
  );
}
