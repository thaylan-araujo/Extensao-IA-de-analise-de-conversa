import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

type Role = "super_admin" | "gestor" | "advogado";

function loadEnvFile(path: string) {
  const text = readFileSync(path, "utf8");

  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2];
    }
  }
}

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Variavel obrigatoria ausente: ${name}`);
  }
  return value;
}

async function findUserByEmail(email: string) {
  const normalized = email.toLowerCase();
  let page = 1;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;

    const user = data.users.find((candidate) => candidate.email?.toLowerCase() === normalized);
    if (user) return user;
    if (data.users.length < 1000) return null;
    page += 1;
  }
}

async function getOrCreateOrganization(name: string) {
  const { data: existing, error: selectError } = await supabase
    .from("organizations")
    .select("id")
    .eq("name", name)
    .maybeSingle();

  if (selectError) throw selectError;
  if (existing) return existing.id as string;

  const { data, error } = await supabase
    .from("organizations")
    .insert({ name })
    .select("id")
    .single();

  if (error) throw error;
  return data.id as string;
}

async function upsertSeedUser(input: {
  email: string;
  password: string;
  fullName: string;
  organizationId: string;
  role: Role;
}) {
  const email = input.email.toLowerCase();
  const existing = await findUserByEmail(email);

  const user =
    existing ??
    (
      await supabase.auth.admin.createUser({
        email,
        password: input.password,
        email_confirm: true,
        user_metadata: { full_name: input.fullName }
      })
    ).data.user;

  if (!user) {
    throw new Error(`Nao foi possivel criar usuario seed: ${email}`);
  }

  if (existing) {
    const { error } = await supabase.auth.admin.updateUserById(existing.id, {
      password: input.password,
      user_metadata: { full_name: input.fullName },
      ban_duration: "none"
    });
    if (error) throw error;
  }

  const { error: profileError } = await supabase.from("profiles").upsert(
    {
      user_id: user.id,
      organization_id: input.organizationId,
      full_name: input.fullName,
      role: input.role,
      status: "active",
      removed_at: null
    },
    { onConflict: "user_id" }
  );

  if (profileError) throw profileError;
  return user.id;
}

loadEnvFile(".env.local");

const supabase = createClient(
  requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
  requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

const password = requiredEnv("SEED_USER_PASSWORD");
const superAdminEmail = process.env.SEED_SUPERADMIN_EMAIL || "thaylan+admin@elitejuris.com.br";
const gestorEmail = process.env.SEED_GESTOR_EMAIL || "thaylan+gestor@elitejuris.com.br";
const advogadoEmail = process.env.SEED_ADVOGADO_EMAIL || "thaylan+advogado@elitejuris.com.br";

async function main() {
  const eliteJurisOrgId = await getOrCreateOrganization("Elite Juris (interna)");
  const demoOrgId = await getOrCreateOrganization("Escritorio Demo");

  await upsertSeedUser({
    email: superAdminEmail,
    password,
    fullName: "Administrador Elite Juris",
    organizationId: eliteJurisOrgId,
    role: "super_admin"
  });

  await upsertSeedUser({
    email: gestorEmail,
    password,
    fullName: "Gestor Demo",
    organizationId: demoOrgId,
    role: "gestor"
  });

  await upsertSeedUser({
    email: advogadoEmail,
    password,
    fullName: "Advogado Demo",
    organizationId: demoOrgId,
    role: "advogado"
  });

  console.log("Seed concluido: Elite Juris interna e Escritorio Demo prontos.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
