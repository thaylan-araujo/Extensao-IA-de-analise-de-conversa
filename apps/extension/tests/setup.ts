/**
 * Setup dos testes da extensão: mock em memória de chrome.storage.local.
 * Cobre o contrato mínimo (get/set/remove) usado pelo storage adapter do
 * supabase-js (plano 02-05) e pelos demais testes dos próximos planos.
 */
import { beforeEach } from "vitest";

const memoryStore = new Map<string, unknown>();

const localMock = {
  async get(
    keys?: string | string[] | Record<string, unknown> | null,
  ): Promise<Record<string, unknown>> {
    if (keys == null) {
      return Object.fromEntries(memoryStore);
    }
    if (typeof keys === "string") {
      return memoryStore.has(keys) ? { [keys]: memoryStore.get(keys) } : {};
    }
    if (Array.isArray(keys)) {
      const out: Record<string, unknown> = {};
      for (const key of keys) {
        if (memoryStore.has(key)) out[key] = memoryStore.get(key);
      }
      return out;
    }
    // objeto com defaults
    const out: Record<string, unknown> = {};
    for (const [key, fallback] of Object.entries(keys)) {
      out[key] = memoryStore.has(key) ? memoryStore.get(key) : fallback;
    }
    return out;
  },

  async set(items: Record<string, unknown>): Promise<void> {
    for (const [key, value] of Object.entries(items)) {
      memoryStore.set(key, value);
    }
  },

  async remove(keys: string | string[]): Promise<void> {
    for (const key of Array.isArray(keys) ? keys : [keys]) {
      memoryStore.delete(key);
    }
  },
};

// Injeta o mock no global (happy-dom não fornece chrome.*)
(globalThis as Record<string, unknown>).chrome = {
  storage: { local: localMock },
};

beforeEach(() => {
  memoryStore.clear();
});
