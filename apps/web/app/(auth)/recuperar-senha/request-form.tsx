"use client";

import { FormEvent, useState } from "react";

import { createClient } from "../../../lib/supabase/client";

const RESET_MESSAGE =
  "Se o e-mail existir, enviamos um link para redefinir a senha.";

export function RequestPasswordResetForm() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);

    try {
      const supabase = createClient();
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin;

      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${siteUrl}/auth/confirm?next=/nova-senha`
      });
    } finally {
      setMessage(RESET_MESSAGE);
      setIsLoading(false);
    }
  }

  return (
    <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
      <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
        E-mail
        <input
          className="h-11 rounded border border-zinc-300 bg-white px-3 text-base outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
          autoComplete="email"
          inputMode="email"
          onChange={(event) => setEmail(event.target.value)}
          required
          type="email"
          value={email}
        />
      </label>
      {message ? <p className="text-sm font-medium text-emerald-700">{message}</p> : null}
      <button
        className="h-11 rounded bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
        disabled={isLoading}
        type="submit"
      >
        {isLoading ? "Enviando..." : "Enviar link"}
      </button>
    </form>
  );
}
