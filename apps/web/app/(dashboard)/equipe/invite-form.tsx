"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function InviteForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"advogado" | "gestor">("advogado");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    setIsLoading(true);

    const response = await fetch("/api/invitations", {
      body: JSON.stringify({ email, role }),
      headers: { "content-type": "application/json" },
      method: "POST"
    });
    const payload = await response.json();

    setIsLoading(false);

    if (!response.ok) {
      setError(payload.error ?? "Não foi possível enviar o convite.");
      return;
    }

    setEmail("");
    setRole("advogado");
    setMessage("Convite enviado.");
    router.refresh();
  }

  return (
    <form className="grid gap-3 rounded border border-zinc-200 bg-white p-4" onSubmit={handleSubmit}>
      <div className="grid gap-3 sm:grid-cols-[minmax(180px,1fr)_150px]">
        <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
          E-mail
          <input
            className="h-10 rounded border border-zinc-300 bg-white px-3 text-base outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            inputMode="email"
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            value={email}
          />
        </label>
        <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
          Papel
          <select
            className="h-10 rounded border border-zinc-300 bg-white px-3 text-sm outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            onChange={(event) => setRole(event.target.value as "advogado" | "gestor")}
            value={role}
          >
            <option value="advogado">advogado</option>
            <option value="gestor">gestor</option>
          </select>
        </label>
      </div>
      {message ? <p className="text-sm font-medium text-emerald-700">{message}</p> : null}
      {error ? <p className="text-sm font-medium text-red-700">{error}</p> : null}
      <button
        className="h-10 rounded bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
        disabled={isLoading}
        type="submit"
      >
        {isLoading ? "Enviando..." : "Convidar"}
      </button>
    </form>
  );
}
