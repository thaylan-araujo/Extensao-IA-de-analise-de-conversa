"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function CreateOrgForm() {
  const router = useRouter();
  const [organizationName, setOrganizationName] = useState("");
  const [gestorEmail, setGestorEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    setIsLoading(true);

    const response = await fetch("/api/admin/organizations", {
      body: JSON.stringify({ gestorEmail, organizationName }),
      headers: { "content-type": "application/json" },
      method: "POST"
    });
    const payload = await response.json();

    setIsLoading(false);

    if (!response.ok) {
      setError(payload.error ?? "Não foi possível criar a organização.");
      return;
    }

    setOrganizationName("");
    setGestorEmail("");
    setMessage("Organização criada. Convite enviado ao gestor.");
    router.refresh();
  }

  return (
    <form
      className="grid gap-3 rounded border border-zinc-200 bg-white p-4"
      onSubmit={handleSubmit}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
          Nome do escritório
          <input
            className="h-10 rounded border border-zinc-300 bg-white px-3 text-base outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            minLength={2}
            onChange={(event) => setOrganizationName(event.target.value)}
            required
            type="text"
            value={organizationName}
          />
        </label>
        <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
          E-mail do gestor
          <input
            className="h-10 rounded border border-zinc-300 bg-white px-3 text-base outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            inputMode="email"
            onChange={(event) => setGestorEmail(event.target.value)}
            required
            type="email"
            value={gestorEmail}
          />
        </label>
      </div>
      {message ? <p className="text-sm font-medium text-emerald-700">{message}</p> : null}
      {error ? <p className="text-sm font-medium text-red-700">{error}</p> : null}
      <button
        className="h-10 rounded bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
        disabled={isLoading}
        type="submit"
      >
        {isLoading ? "Criando..." : "Criar organização"}
      </button>
    </form>
  );
}
