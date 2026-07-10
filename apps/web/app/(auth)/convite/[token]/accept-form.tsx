"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function AcceptForm({ email, token }: { email: string; token: string }) {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsLoading(true);

    const response = await fetch("/api/invitations/accept", {
      body: JSON.stringify({ fullName, password, token }),
      headers: { "content-type": "application/json" },
      method: "POST"
    });
    const payload = await response.json();

    if (!response.ok) {
      setError(payload.error ?? "Não foi possível aceitar o convite.");
      setIsLoading(false);
      return;
    }

    router.push("/login?created=1");
    router.refresh();
  }

  return (
    <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
      <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
        E-mail
        <input
          className="h-11 rounded border border-zinc-300 bg-zinc-100 px-3 text-base text-zinc-600"
          readOnly
          type="email"
          value={email}
        />
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
        Nome completo
        <input
          className="h-11 rounded border border-zinc-300 bg-white px-3 text-base outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
          autoComplete="name"
          onChange={(event) => setFullName(event.target.value)}
          required
          type="text"
          value={fullName}
        />
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
        Senha
        <input
          className="h-11 rounded border border-zinc-300 bg-white px-3 text-base outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
          autoComplete="new-password"
          minLength={8}
          onChange={(event) => setPassword(event.target.value)}
          required
          type="password"
          value={password}
        />
      </label>
      {error ? <p className="text-sm font-medium text-red-700">{error}</p> : null}
      <button
        className="h-11 rounded bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
        disabled={isLoading}
        type="submit"
      >
        {isLoading ? "Criando..." : "Criar conta"}
      </button>
    </form>
  );
}
