/**
 * Indireção de env da extensão (padrão env.ts da Fase 1 — apps/web/lib/supabase/env.ts):
 * um único módulo valida e exporta as variáveis; nenhum import.meta.env espalhado.
 *
 * O prefixo WXT_ expõe a variável ao bundle via import.meta.env (WXT/Vite) —
 * ver .env.example na raiz do repo. anon key é pública por design; RLS protege.
 */
export interface ExtensionEnv {
  supabaseUrl: string;
  supabaseAnonKey: string;
  webAppUrl: string;
}

export function getExtensionEnv(): ExtensionEnv {
  const supabaseUrl = import.meta.env.WXT_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.WXT_SUPABASE_ANON_KEY;
  const webAppUrl = import.meta.env.WXT_WEB_APP_URL;

  if (!supabaseUrl || !supabaseAnonKey || !webAppUrl) {
    throw new Error(
      "Variáveis de ambiente da extensão ausentes: defina WXT_SUPABASE_URL, " +
        "WXT_SUPABASE_ANON_KEY e WXT_WEB_APP_URL em apps/extension/.env.local " +
        "(modelo em .env.example na raiz do repositório).",
    );
  }

  return { supabaseUrl, supabaseAnonKey, webAppUrl };
}
