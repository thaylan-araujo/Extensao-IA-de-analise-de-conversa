"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@copiloto/shared";

import { getSupabaseBrowserEnv } from "./env";

export function createClient() {
  const { supabaseUrl, supabaseAnonKey } = getSupabaseBrowserEnv();

  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
}
