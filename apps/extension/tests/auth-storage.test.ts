/**
 * Testes do ciclo de sessão da extensão (plano 02-03, Task 1 — TDD):
 * - chromeStorageAdapter sobre o mock de chrome.storage.local (tests/setup.ts)
 * - createExtensionClient com persistSession via storage adapter
 * - restoreSession tolerante a storage vazio (issue supabase-js#2030)
 * - signOutAndClear limpando as chaves de sessão
 * - checkProfileStatus distinguindo active / removed / erro-de-rede (base do D-11)
 *
 * Nenhum teste toca o Supabase real: chamadas de rede são mockadas via fetch stub.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Session } from "@supabase/supabase-js";

import {
  AUTH_STORAGE_KEY,
  chromeStorageAdapter,
  createExtensionClient,
} from "../entrypoints/whatsapp.content/sync/supabase";
import {
  checkProfileStatus,
  restoreSession,
  signOutAndClear,
} from "../entrypoints/whatsapp.content/sync/session";

const TEST_URL = "https://testproj.supabase.co";
const TEST_KEY = "anon-test-key";
const USER_ID = "11111111-1111-4111-8111-111111111111";

function makeFakeSession(): Session {
  return {
    access_token: "header.payload.signature",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: "refresh-token-fake",
    user: {
      id: USER_ID,
      aud: "authenticated",
      email: "advogado@teste.com.br",
      app_metadata: {},
      user_metadata: {},
      created_at: new Date().toISOString(),
    },
  } as Session;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("chromeStorageAdapter", () => {
  it("setItem grava e getItem lê o mesmo valor", async () => {
    await chromeStorageAdapter.setItem("chave", "valor-teste");
    await expect(chromeStorageAdapter.getItem("chave")).resolves.toBe(
      "valor-teste",
    );
  });

  it("removeItem apaga a chave", async () => {
    await chromeStorageAdapter.setItem("chave", "valor-teste");
    await chromeStorageAdapter.removeItem("chave");
    await expect(chromeStorageAdapter.getItem("chave")).resolves.toBeNull();
  });

  it("getItem de chave inexistente retorna null", async () => {
    await expect(
      chromeStorageAdapter.getItem("nao-existe"),
    ).resolves.toBeNull();
  });
});

describe("createExtensionClient", () => {
  it("persiste e restaura a sessão via chrome.storage.local (AUTH-02/D-10)", async () => {
    const fakeSession = makeFakeSession();
    await chrome.storage.local.set({
      [AUTH_STORAGE_KEY]: JSON.stringify(fakeSession),
    });

    const client = createExtensionClient(TEST_URL, TEST_KEY);
    try {
      const { data, error } = await client.auth.getSession();
      expect(error).toBeNull();
      expect(data.session?.access_token).toBe(fakeSession.access_token);
      expect(data.session?.user.id).toBe(USER_ID);
    } finally {
      await client.auth.stopAutoRefresh();
    }
  });
});

describe("restoreSession", () => {
  it("com storage vazio resolve para null SEM lançar (issue supabase-js#2030)", async () => {
    const client = createExtensionClient(TEST_URL, TEST_KEY);
    try {
      await expect(restoreSession(client)).resolves.toBeNull();
    } finally {
      await client.auth.stopAutoRefresh();
    }
  });

  it("com sessão válida no storage resolve para a sessão", async () => {
    const fakeSession = makeFakeSession();
    await chrome.storage.local.set({
      [AUTH_STORAGE_KEY]: JSON.stringify(fakeSession),
    });

    const client = createExtensionClient(TEST_URL, TEST_KEY);
    try {
      const session = await restoreSession(client);
      expect(session?.access_token).toBe(fakeSession.access_token);
    } finally {
      await client.auth.stopAutoRefresh();
    }
  });
});

describe("signOutAndClear", () => {
  it("chama auth.signOut e remove as chaves de sessão do storage", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({}, 204));
    vi.stubGlobal("fetch", fetchMock);

    const fakeSession = makeFakeSession();
    await chrome.storage.local.set({
      [AUTH_STORAGE_KEY]: JSON.stringify(fakeSession),
    });

    const client = createExtensionClient(TEST_URL, TEST_KEY);
    try {
      await signOutAndClear(client);
    } finally {
      await client.auth.stopAutoRefresh();
    }

    const stored = await chrome.storage.local.get(AUTH_STORAGE_KEY);
    expect(stored[AUTH_STORAGE_KEY]).toBeUndefined();
  });

  it("limpa o storage mesmo se o signOut de rede falhar (logout offline)", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("rede indisponível");
    });
    vi.stubGlobal("fetch", fetchMock);

    const fakeSession = makeFakeSession();
    await chrome.storage.local.set({
      [AUTH_STORAGE_KEY]: JSON.stringify(fakeSession),
    });

    const client = createExtensionClient(TEST_URL, TEST_KEY);
    try {
      await signOutAndClear(client);
    } finally {
      await client.auth.stopAutoRefresh();
    }

    const stored = await chrome.storage.local.get(AUTH_STORAGE_KEY);
    expect(stored[AUTH_STORAGE_KEY]).toBeUndefined();
  });
});

describe("checkProfileStatus", () => {
  it('retorna "removed" quando o select de profiles vem vazio (RLS negou — D-11)', async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse([])),
    );
    const client = createExtensionClient(TEST_URL, TEST_KEY);
    try {
      const result = await checkProfileStatus(USER_ID, client);
      expect(result.kind).toBe("removed");
    } finally {
      await client.auth.stopAutoRefresh();
    }
  });

  it('retorna "removed" quando o profile vem com status removed', async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse([
          {
            full_name: "Advogado Removido",
            role: "advogado",
            status: "removed",
            organization_id: "org-1",
          },
        ]),
      ),
    );
    const client = createExtensionClient(TEST_URL, TEST_KEY);
    try {
      const result = await checkProfileStatus(USER_ID, client);
      expect(result.kind).toBe("removed");
    } finally {
      await client.auth.stopAutoRefresh();
    }
  });

  it('retorna "active" com os dados do profile quando ativo', async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse([
          {
            full_name: "Advogado Ativo",
            role: "advogado",
            status: "active",
            organization_id: "org-1",
          },
        ]),
      ),
    );
    const client = createExtensionClient(TEST_URL, TEST_KEY);
    try {
      const result = await checkProfileStatus(USER_ID, client);
      expect(result).toEqual({
        kind: "active",
        profile: {
          fullName: "Advogado Ativo",
          role: "advogado",
          organizationId: "org-1",
        },
      });
    } finally {
      await client.auth.stopAutoRefresh();
    }
  });

  it('retorna "error" em falha de rede — NUNCA engole o erro como removed (Pitfall 3)', async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("rede indisponível");
      }),
    );
    const client = createExtensionClient(TEST_URL, TEST_KEY);
    try {
      const result = await checkProfileStatus(USER_ID, client);
      expect(result.kind).toBe("error");
    } finally {
      await client.auth.stopAutoRefresh();
    }
  });
});
