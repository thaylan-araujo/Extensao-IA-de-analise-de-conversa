/**
 * Ciclo de sessão da extensão (plano 02-03, Task 1).
 *
 * Regra do Pitfall 3 (02-RESEARCH.md): falha de refresh/401 NUNCA é engolida —
 * o chamador recebe um estado tipado para trocar a view do painel
 * ("deslogado", "removido") em vez de fingir que o monitoramento continua.
 */
import type { Session } from "@supabase/supabase-js";
import type { ProfileStatus, UserRole } from "@copiloto/shared";

import {
  AUTH_STORAGE_KEY,
  supabase,
  type ExtensionSupabaseClient,
} from "./supabase";

export interface ActiveProfile {
  fullName: string;
  role: UserRole;
  organizationId: string;
}

/** Resultado tipado do check de profile — distingue removido de erro de rede (D-11). */
export type ProfileCheck =
  | { kind: "active"; profile: ActiveProfile }
  | { kind: "removed" }
  | { kind: "error"; message: string };

/**
 * Restaura a sessão persistida em chrome.storage.local.
 * Storage vazio/recém-limpo resolve para null SEM lançar (issue supabase-js#2030);
 * erro de refresh também vira null — o painel volta para a view "deslogado".
 */
export async function restoreSession(
  client: ExtensionSupabaseClient = supabase,
): Promise<Session | null> {
  try {
    const { data, error } = await client.auth.getSession();
    if (error) {
      // Refresh falhou (token revogado/expirado) — sem sessão utilizável.
      return null;
    }
    return data.session;
  } catch {
    // Storage recém-limpo pode lançar na inicialização (supabase-js#2030).
    return null;
  }
}

/**
 * Consulta o próprio profile para detectar remoção (D-11).
 * - Select vazio (RLS/ban negou) ou status "removed" → { kind: "removed" }
 * - Falha de rede → { kind: "error" } — NUNCA classificar erro como removido.
 */
export async function checkProfileStatus(
  userId: string,
  client: ExtensionSupabaseClient = supabase,
): Promise<ProfileCheck> {
  try {
    const { data, error } = await client
      .from("profiles")
      .select("full_name, role, status, organization_id")
      .eq("user_id", userId)
      .limit(1);

    if (error) {
      return { kind: "error", message: error.message };
    }

    const row = data?.[0];
    if (!row || (row.status as ProfileStatus) === "removed") {
      return { kind: "removed" };
    }

    return {
      kind: "active",
      profile: {
        fullName: row.full_name,
        role: row.role as UserRole,
        organizationId: row.organization_id,
      },
    };
  } catch (err) {
    return {
      kind: "error",
      message: err instanceof Error ? err.message : "Falha de rede desconhecida.",
    };
  }
}

/**
 * Logout: revoga a sessão no servidor (quando a rede permite) e SEMPRE limpa
 * as chaves de sessão do chrome.storage.local — logout funciona offline.
 */
export async function signOutAndClear(
  client: ExtensionSupabaseClient = supabase,
): Promise<void> {
  try {
    await client.auth.signOut();
  } catch {
    // Sem rede o signOut remoto falha — a limpeza local abaixo garante o logout.
  }

  // Limpeza defensiva: a chave própria + qualquer chave sb-* legada do supabase-js.
  await chrome.storage.local.remove(AUTH_STORAGE_KEY);
  const all = await chrome.storage.local.get(null);
  const staleKeys = Object.keys(all).filter((key) => key.startsWith("sb-"));
  if (staleKeys.length > 0) {
    await chrome.storage.local.remove(staleKeys);
  }
}
