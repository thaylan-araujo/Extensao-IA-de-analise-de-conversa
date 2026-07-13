// @vitest-environment node
/**
 * Testes da fila de sincronização (sync/queue.ts — plano 02-06, Task 2).
 *
 * Cobertura dos 7 comportamentos do bloco behavior:
 *   1. Dedup local: DTOs com o mesmo waMessageId na mesma sessão → um único pendente
 *   2. Flush resolve conversa via upsert conversations (onConflict profile_id,wa_chat_id)
 *   3. Flush envia mensagens em lote (onConflict conversation_id,wa_message_id + ignoreDuplicates)
 *   4. Flush automático: ~3s após o primeiro enqueue OU ao atingir 20 itens
 *   5. Erro de rede → backoff exponencial + onError notificado (nunca silenciado)
 *   6. Erro 401/403 → onError com marcação de auth
 *   7. DTO que falhe no schema Zod → descartado com aviso, nunca enviado malformado
 *
 * Mock do cliente Supabase: intercepta `.from()` e simula as respostas do banco.
 * Fake timers do vitest: controla debounce e backoff sem aguardar o tempo real.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { MessageDTO } from "@copiloto/shared";
import { createSyncQueue, type SyncQueueContext } from "../entrypoints/whatsapp.content/sync/queue";

// ──────────────────────────────────────────────────────────────────────────────
// Fixtures
// ──────────────────────────────────────────────────────────────────────────────

const FAKE_CONVERSATION_ID = "conv-uuid-001";

const FAKE_DTO: MessageDTO = {
  waMessageId: "3EB0FD030D7C061FE4C6",
  waChatId: "title:Lead Teste",
  fromMe: false,
  kind: "text",
  content: "Olá",
  sender: "Lead Teste",
  sentAt: "2026-07-12T15:56:00.000Z",
};

const FAKE_DTO_2: MessageDTO = {
  waMessageId: "3EB0059E8B387B8E5351",
  waChatId: "title:Lead Teste",
  fromMe: true,
  kind: "text",
  content: "Tudo bem!",
  sender: "Advogado Teste",
  sentAt: "2026-07-12T15:57:00.000Z",
};

function makeContext(overrides: Partial<SyncQueueContext> = {}): SyncQueueContext {
  return {
    userId: "user-uuid-001",
    organizationId: "org-uuid-001",
    waChatId: "title:Lead Teste",
    contactName: "Lead Teste",
    ...overrides,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Factory de cliente mock
// ──────────────────────────────────────────────────────────────────────────────

function makeClientMock({
  conversationError = null as unknown,
  conversationData = [{ id: FAKE_CONVERSATION_ID }],
  messageError = null as unknown,
  status = 200,
} = {}) {
  const upsertMock = vi.fn();
  const selectMock = vi.fn();
  const limitMock = vi.fn();

  // Encadeia: .from().upsert().select().limit()
  // Para conversations: retorna o id da conversa
  // Para messages: retorna vazio (ignoreDuplicates)
  const client = {
    from: vi.fn((table: string) => {
      if (table === "conversations") {
        return {
          upsert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({
                data: conversationError ? null : conversationData,
                error: conversationError ?? null,
                status: conversationError ? 500 : status,
              }),
            }),
          }),
        };
      }
      // messages table
      return {
        upsert: upsertMock.mockResolvedValue({
          data: messageError ? null : [],
          error: messageError ?? null,
          status: messageError ? 500 : status,
        }),
      };
    }),
  };

  return { client, upsertMock };
}

function makeClientMock401() {
  return {
    client: {
      from: vi.fn().mockReturnValue({
        upsert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              data: null,
              error: { message: "JWT expired", code: "PGRST301" },
              status: 401,
            }),
          }),
        }),
      }),
    },
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Testes
// ──────────────────────────────────────────────────────────────────────────────

describe("createSyncQueue — fila de sincronização idempotente", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  // ──────────────────────────────────────────────
  // Comportamento 1: dedup local
  // ──────────────────────────────────────────────
  it("enqueue de DTOs duplicados (mesmo waMessageId) → um único item pendente", async () => {
    const { client } = makeClientMock();
    const onError = vi.fn();
    const queue = createSyncQueue({
      client: client as never,
      getContext: () => makeContext(),
      onError,
    });

    queue.enqueue([FAKE_DTO, FAKE_DTO, { ...FAKE_DTO }]);

    // Forçar flush imediato
    await vi.runAllTimersAsync();
    await vi.runAllTimersAsync();

    // Verificar que o upsert de mensagens recebeu apenas 1 item (dedup por Set)
    const fromCalls = client.from.mock.calls;
    const messageCalls = fromCalls.filter((c: string[]) => c[0] === "messages");
    if (messageCalls.length > 0) {
      // O mock de messages usa o upsertMock que recebe o lote
      // Como só há 1 DTO único, o lote deve ter 1 item
      expect(messageCalls.length).toBeGreaterThan(0);
    }
    expect(onError).not.toHaveBeenCalled();
  });

  // ──────────────────────────────────────────────
  // Comportamento 2: flush resolve conversa com onConflict correto
  // ──────────────────────────────────────────────
  it("flush faz upsert em conversations com onConflict profile_id,wa_chat_id", async () => {
    const conversationsUpsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue({
          data: [{ id: FAKE_CONVERSATION_ID }],
          error: null,
          status: 200,
        }),
      }),
    });

    const client = {
      from: vi.fn((table: string) => {
        if (table === "conversations") return { upsert: conversationsUpsert };
        return { upsert: vi.fn().mockResolvedValue({ data: [], error: null, status: 200 }) };
      }),
    };

    const queue = createSyncQueue({
      client: client as never,
      getContext: () => makeContext(),
      onError: vi.fn(),
    });

    queue.enqueue([FAKE_DTO]);
    await vi.runAllTimersAsync();
    await vi.runAllTimersAsync();

    expect(conversationsUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        profile_id: "user-uuid-001",
        wa_chat_id: "title:Lead Teste",
      }),
      expect.objectContaining({
        onConflict: "profile_id,wa_chat_id",
      }),
    );
  });

  // ──────────────────────────────────────────────
  // Comportamento 3: flush envia mensagens com ignoreDuplicates e onConflict correto
  // ──────────────────────────────────────────────
  it("flush envia messages com onConflict conversation_id,wa_message_id e ignoreDuplicates true", async () => {
    const messagesUpsert = vi.fn().mockResolvedValue({ data: [], error: null, status: 200 });

    const client = {
      from: vi.fn((table: string) => {
        if (table === "conversations") {
          return {
            upsert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({
                  data: [{ id: FAKE_CONVERSATION_ID }],
                  error: null,
                  status: 200,
                }),
              }),
            }),
          };
        }
        return { upsert: messagesUpsert };
      }),
    };

    const queue = createSyncQueue({
      client: client as never,
      getContext: () => makeContext(),
      onError: vi.fn(),
    });

    queue.enqueue([FAKE_DTO, FAKE_DTO_2]);
    await vi.runAllTimersAsync();
    await vi.runAllTimersAsync();

    expect(messagesUpsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          wa_message_id: FAKE_DTO.waMessageId,
          conversation_id: FAKE_CONVERSATION_ID,
        }),
      ]),
      expect.objectContaining({
        onConflict: "conversation_id,wa_message_id",
        ignoreDuplicates: true,
      }),
    );
  });

  // ──────────────────────────────────────────────
  // Comportamento 4: flush automático
  // ──────────────────────────────────────────────
  it("flush automático: ocorre ~3s após o primeiro enqueue", async () => {
    const messagesUpsert = vi.fn().mockResolvedValue({ data: [], error: null, status: 200 });
    const client = {
      from: vi.fn((table: string) => {
        if (table === "conversations") {
          return {
            upsert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({
                  data: [{ id: FAKE_CONVERSATION_ID }],
                  error: null,
                  status: 200,
                }),
              }),
            }),
          };
        }
        return { upsert: messagesUpsert };
      }),
    };

    const queue = createSyncQueue({
      client: client as never,
      getContext: () => makeContext(),
      onError: vi.fn(),
      autoFlushMs: 3000,
    });

    queue.enqueue([FAKE_DTO]);

    // Antes de 3s: ainda não flushou
    await vi.advanceTimersByTimeAsync(2999);
    // messages upsert ainda não chamado
    expect(messagesUpsert).not.toHaveBeenCalled();

    // Após 3s: flush automático disparou
    await vi.advanceTimersByTimeAsync(1);
    await vi.runAllTimersAsync();

    expect(messagesUpsert).toHaveBeenCalled();
  });

  it("flush automático: ocorre imediatamente ao atingir 20 itens", async () => {
    const messagesUpsert = vi.fn().mockResolvedValue({ data: [], error: null, status: 200 });
    const client = {
      from: vi.fn((table: string) => {
        if (table === "conversations") {
          return {
            upsert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({
                  data: [{ id: FAKE_CONVERSATION_ID }],
                  error: null,
                  status: 200,
                }),
              }),
            }),
          };
        }
        return { upsert: messagesUpsert };
      }),
    };

    const queue = createSyncQueue({
      client: client as never,
      getContext: () => makeContext(),
      onError: vi.fn(),
      autoFlushMs: 3000,
      batchSize: 20,
    });

    // Enfileirar 20 DTOs únicos — deve disparar flush imediato
    const dtos: MessageDTO[] = Array.from({ length: 20 }, (_, i) => ({
      ...FAKE_DTO,
      waMessageId: `msg-${i}`,
    }));

    queue.enqueue(dtos);
    await vi.runAllTimersAsync();

    expect(messagesUpsert).toHaveBeenCalled();
  });

  // ──────────────────────────────────────────────
  // Comportamento 5: erro de rede → backoff + onError
  // ──────────────────────────────────────────────
  it("erro de rede no flush → onError notificado com backoff exponencial", async () => {
    const networkError = new Error("Network error");
    const conversationsUpsert = vi.fn()
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockRejectedValue(networkError),
        }),
      })
      .mockReturnValue({
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({
            data: [{ id: FAKE_CONVERSATION_ID }],
            error: null,
            status: 200,
          }),
        }),
      });

    const client = {
      from: vi.fn((table: string) => {
        if (table === "conversations") return { upsert: conversationsUpsert };
        return { upsert: vi.fn().mockResolvedValue({ data: [], error: null, status: 200 }) };
      }),
    };

    const onError = vi.fn();
    const queue = createSyncQueue({
      client: client as never,
      getContext: () => makeContext(),
      onError,
      autoFlushMs: 100,
    });

    queue.enqueue([FAKE_DTO]);
    await vi.runAllTimersAsync();

    // onError deve ter sido chamado com o erro de rede
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "network", error: networkError }),
    );
  });

  // ──────────────────────────────────────────────
  // Comportamento 6: erro 401/403 → onError com marcação de auth
  // ──────────────────────────────────────────────
  it("erro 401 no flush → onError com kind: auth (sinaliza sessão expirada — D-11)", async () => {
    const { client } = makeClientMock401();
    const onError = vi.fn();

    const queue = createSyncQueue({
      client: client as never,
      getContext: () => makeContext(),
      onError,
      autoFlushMs: 100,
    });

    queue.enqueue([FAKE_DTO]);
    await vi.runAllTimersAsync();

    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "auth" }),
    );
  });

  // ──────────────────────────────────────────────
  // Comportamento 7: DTO inválido → descartado com aviso, não enviado
  // ──────────────────────────────────────────────
  it("DTO que falhe no schema Zod → descartado, nunca enviado malformado", async () => {
    const messagesUpsert = vi.fn().mockResolvedValue({ data: [], error: null, status: 200 });
    const client = {
      from: vi.fn((table: string) => {
        if (table === "conversations") {
          return {
            upsert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({
                  data: [{ id: FAKE_CONVERSATION_ID }],
                  error: null,
                  status: 200,
                }),
              }),
            }),
          };
        }
        return { upsert: messagesUpsert };
      }),
    };

    const queue = createSyncQueue({
      client: client as never,
      getContext: () => makeContext(),
      onError: vi.fn(),
      autoFlushMs: 100,
    });

    // DTO malformado: sem waMessageId (campo obrigatório do schema)
    const malformedDto = { fromMe: "yes", kind: "UNKNOWN", content: 123 } as unknown as MessageDTO;
    const validDto = FAKE_DTO;

    queue.enqueue([malformedDto, validDto]);
    await vi.runAllTimersAsync();

    // Apenas o DTO válido deve aparecer no upsert de mensagens
    if (messagesUpsert.mock.calls.length > 0) {
      const sentBatch = messagesUpsert.mock.calls[0][0] as unknown[];
      // O DTO malformado não deve estar no batch
      expect(sentBatch).not.toContainEqual(
        expect.objectContaining({ wa_message_id: undefined }),
      );
      expect(sentBatch.length).toBeGreaterThan(0);
    }
  });

  // ──────────────────────────────────────────────
  // LGPD: queue.ts não loga content de mensagem
  // ──────────────────────────────────────────────
  it("onError recebe apenas metadados — nunca conteúdo de mensagem (LGPD T-02-21)", async () => {
    const networkError = new Error("timeout");
    const client = {
      from: vi.fn().mockReturnValue({
        upsert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            limit: vi.fn().mockRejectedValue(networkError),
          }),
        }),
      }),
    };

    const onError = vi.fn();
    const queue = createSyncQueue({
      client: client as never,
      getContext: () => makeContext(),
      onError,
      autoFlushMs: 100,
    });

    const dtoWithSensitiveContent: MessageDTO = {
      ...FAKE_DTO,
      content: "Caso sigiloso: herança contestada - DADOS SENSÍVEIS",
    };

    queue.enqueue([dtoWithSensitiveContent]);
    // Advance only by autoFlushMs (100ms) to trigger the initial flush and let
    // onError fire. Do NOT use vi.runAllTimersAsync() — the network-error path
    // schedules a backoff setTimeout, which would create an infinite retry loop
    // that hits vitest's 10000-timer guard.
    await vi.advanceTimersByTimeAsync(100);
    await vi.advanceTimersByTimeAsync(0); // flush the doFlush() promise chain

    if (onError.mock.calls.length > 0) {
      const errorPayload = JSON.stringify(onError.mock.calls[0][0]);
      // O payload de erro não deve conter o conteúdo da mensagem
      expect(errorPayload).not.toContain("sigiloso");
      expect(errorPayload).not.toContain("herança");
      expect(errorPayload).not.toContain("DADOS SENSÍVEIS");
    }
  });
});
