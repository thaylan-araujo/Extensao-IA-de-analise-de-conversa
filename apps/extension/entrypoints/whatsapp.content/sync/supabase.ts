/**
 * Cliente Supabase único da extensão (Pattern 2 do 02-RESEARCH.md).
 *
 * - Vive no content script: a aba do WhatsApp é longeva, então o autoRefreshToken
 *   (setInterval) sobrevive — NUNCA mover para o service worker MV3 (morre em ~30s).
 * - Sessão em chrome.storage.local via adapter: persiste entre reinícios do Chrome
 *   e é inacessível ao contexto da página (AUTH-02/D-10, T-02-08).
 * - Cliente SEMPRE tipado com Database de @copiloto/shared (02-PATTERNS.md).
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@copiloto/shared";

import { getExtensionEnv } from "./env";

/** Chave única da sessão em chrome.storage.local (facilita a limpeza no logout). */
export const AUTH_STORAGE_KEY = "copiloto_auth";

/**
 * Adapter de storage do supabase-js sobre chrome.storage.local.
 * chrome.storage.local não é limpo junto com cookies/localStorage do site e
 * sobrevive a reinícios do navegador — AUTH-02 por construção.
 */
export const chromeStorageAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    const result = await chrome.storage.local.get(key);
    return (result[key] as string | undefined) ?? null;
  },
  setItem: async (key: string, value: string): Promise<void> => {
    await chrome.storage.local.set({ [key]: value });
  },
  removeItem: async (key: string): Promise<void> => {
    await chrome.storage.local.remove(key);
  },
};

export type ExtensionSupabaseClient = SupabaseClient<Database>;

/**
 * Factory do cliente da extensão. Sem argumentos usa o env do bundle
 * (WXT_SUPABASE_URL/WXT_SUPABASE_ANON_KEY); os testes injetam url/key fake.
 */
export function createExtensionClient(
  supabaseUrl?: string,
  supabaseAnonKey?: string,
): ExtensionSupabaseClient {
  let url = supabaseUrl;
  let key = supabaseAnonKey;
  if (!url || !key) {
    const env = getExtensionEnv();
    url = env.supabaseUrl;
    key = env.supabaseAnonKey;
  }

  return createClient<Database>(url, key, {
    auth: {
      storage: chromeStorageAdapter,
      storageKey: AUTH_STORAGE_KEY,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false, // extensão não recebe redirects OAuth
    },
  });
}

let singleton: ExtensionSupabaseClient | null = null;

function getSupabase(): ExtensionSupabaseClient {
  if (!singleton) {
    singleton = createExtensionClient();
  }
  return singleton;
}

/**
 * Cliente único da extensão, criado de forma preguiçosa no primeiro acesso
 * (evita exigir env no momento do import — os testes usam createExtensionClient
 * com valores injetados sem tocar este singleton).
 */
export const supabase: ExtensionSupabaseClient = new Proxy(
  {} as ExtensionSupabaseClient,
  {
    get(_target, prop, _receiver) {
      const client = getSupabase();
      const value = Reflect.get(client, prop, client) as unknown;
      return typeof value === "function" ? value.bind(client) : value;
    },
  },
);
