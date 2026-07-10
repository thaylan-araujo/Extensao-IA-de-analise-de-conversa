import { createAdminClient } from "../../../../lib/supabase/admin";
import { hashToken } from "../../../../lib/invitations/token";
import { AcceptForm } from "./accept-form";

export default async function ConvitePage({
  params
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const admin = createAdminClient();
  const { data: invitation } = await admin
    .from("invitations")
    .select("email, expires_at, organization_id, status")
    .eq("token_hash", hashToken(token))
    .eq("status", "pending")
    .maybeSingle();

  if (!invitation || new Date(invitation.expires_at).getTime() <= Date.now()) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-6 py-12 text-zinc-950">
        <section className="w-full max-w-lg rounded border border-zinc-200 bg-white p-8">
          <p className="text-sm font-medium text-red-700">Convite indisponível</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-normal">
            Convite inválido ou expirado.
          </h1>
          <p className="mt-4 text-sm leading-6 text-zinc-600">
            Peça ao gestor para reenviar o convite e tente novamente pelo novo link.
          </p>
        </section>
      </main>
    );
  }

  const { data: organization } = await admin
    .from("organizations")
    .select("name")
    .eq("id", invitation.organization_id)
    .single();

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-6 py-12 text-zinc-950">
      <section className="w-full max-w-sm">
        <div className="mb-8">
          <p className="text-sm font-medium text-emerald-700">
            Convite para {organization?.name ?? "sua organização"}
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-normal">
            Crie sua conta
          </h1>
          <p className="mt-3 text-sm leading-6 text-zinc-600">
            Informe seu nome completo e defina uma senha para acessar.
          </p>
        </div>
        <AcceptForm email={invitation.email} token={token} />
      </section>
    </main>
  );
}
