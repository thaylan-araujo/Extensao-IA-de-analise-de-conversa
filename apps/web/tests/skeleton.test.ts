import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

function requiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(
      `Variavel de ambiente obrigatoria ausente: ${name}. Configure .env.local para executar o esqueleto contra o Supabase seedado.`
    );
  }

  return value;
}

describe("walking skeleton do gestor", () => {
  it("autentica o gestor demo e le a propria organizacao", async () => {
    const supabase = createClient(
      requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
      requiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    );

    const email = requiredEnv("SEED_GESTOR_EMAIL");
    const password = requiredEnv("SEED_USER_PASSWORD");

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    expect(authError).toBeNull();
    expect(authData.user?.email).toBe(email);

    const { data: organizations, error: organizationError } = await supabase
      .from("organizations")
      .select("name");

    expect(organizationError).toBeNull();
    expect(organizations).toEqual([{ name: "Escritorio Demo" }]);

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", authData.user?.id)
      .single();

    expect(profileError).toBeNull();
    expect(profile?.role).toBe("gestor");
  });
});
