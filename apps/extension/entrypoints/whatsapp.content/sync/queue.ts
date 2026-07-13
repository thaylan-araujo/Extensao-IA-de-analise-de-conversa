/**
 * Fila de sincronização idempotente (plano 02-06, Task 2 — EXT-04, D-01).
 *
 * Regras invioláveis:
 * - Idempotência REAL é a unique constraint no banco (EXT-04); o Set local é
 *   apenas economia de rede (Pitfall 6: recarregar a aba zera o Set sem risco).
 * - Erros NUNCA são engolidos (Pitfall 3): onError é sempre chamado com um
 *   objeto tipado { kind, error? } — o chamador decide como reagir.
 * - Nenhum content de mensagem em logs/erros (LGPD T-02-21).
 * - Fluxo: upsert conversations primeiro (recupera id) → upsert messages em lote.
 *
 * Colunas de conflito (migration 20260712000000_extension_sync.sql):
 * - conversations: onConflict "profile_id,wa_chat_id"
 * - messages:      onConflict "conversation_id,wa_message_id" + ignoreDuplicates: true
 */
import type { MessageDTO } from "@copiloto/shared";
import type { ExtensionSupabaseClient } from "./supabase";
import { filterValidDtos } from "./schema";

/** Contexto do ciclo de leitura (injetado por parâmetro — sem import circular). */
export interface SyncQueueContext {
  /** user_id do advogado logado (alimenta profile_id). */
  userId: string;
  /** organization_id da org do advogado (alimenta RLS). */
  organizationId: string;
  /** wa_chat_id da conversa ativa (opaca — não derivar telefone). */
  waChatId: string;
  /** Nome de exibição do contato (display name do header). */
  contactName: string | null;
}

/** Tipos de erro tipados para o onError (nunca inclui conteúdo de mensagem). */
export type SyncError =
  | { kind: "auth"; message: string }
  | { kind: "network"; error: unknown; attempt: number }
  | { kind: "schema"; discarded: number }
  | { kind: "unknown"; error: unknown };

export interface SyncQueueOptions {
  client: ExtensionSupabaseClient;
  /** Contexto dinâmico: função chamada no momento do flush (não no enqueue). */
  getContext: () => SyncQueueContext;
  /** Callback de erro obrigatório (Pitfall 3). */
  onError: (err: SyncError) => void;
  /** Debounce do flush automático em ms (padrão: 3000). */
  autoFlushMs?: number;
  /** Tamanho do lote que dispara flush imediato (padrão: 20). */
  batchSize?: number;
  /** Teto do backoff exponencial em ms (padrão: 60000). */
  backoffCap?: number;
}

/** Backoff exponencial: base * 2^attempt, com teto. */
function computeBackoff(attempt: number, cap: number): number {
  return Math.min(1000 * Math.pow(2, attempt), cap);
}

export interface SyncQueue {
  enqueue(dtos: MessageDTO[]): void;
  flush(): Promise<void>;
}

/**
 * Cria uma fila de sincronização idempotente.
 *
 * A fila mantém:
 * - `pending`: Map de waMessageId → DTO (dedup local — limpeza otimista de rede)
 * - `sentIds`: Set de waMessageId já enviados na sessão (evita re-envio desnecessário)
 * - Timer de flush automático (~3s após o primeiro enqueue ou ao atingir batchSize)
 */
export function createSyncQueue({
  client,
  getContext,
  onError,
  autoFlushMs = 3000,
  batchSize = 20,
  backoffCap = 60000,
}: SyncQueueOptions): SyncQueue {
  /** Dedup local: waMessageId → DTO (pendentes de envio). */
  const pending = new Map<string, MessageDTO>();
  /** waMessageIds enviados com sucesso nesta sessão (economia de rede). */
  const sentIds = new Set<string>();

  let flushTimer: ReturnType<typeof setTimeout> | null = null;
  let flushAttempt = 0;
  let isFlushInProgress = false;

  function scheduleFlush(): void {
    if (flushTimer !== null) return; // já agendado
    flushTimer = setTimeout(() => {
      flushTimer = null;
      void doFlush();
    }, autoFlushMs);
  }

  function cancelFlush(): void {
    if (flushTimer !== null) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
  }

  async function doFlush(): Promise<void> {
    if (isFlushInProgress || pending.size === 0) return;
    isFlushInProgress = true;

    const dtos = [...pending.values()];
    const context = getContext();

    // Validar DTOs no boundary DOM→sync (ASVS V5, T-02-22)
    const valid = filterValidDtos(dtos);
    const discarded = dtos.length - valid.length;
    if (discarded > 0) {
      onError({ kind: "schema", discarded });
    }

    if (valid.length === 0) {
      // Limpar pendentes inválidos
      for (const dto of dtos) pending.delete(dto.waMessageId);
      isFlushInProgress = false;
      return;
    }

    try {
      // ── Passo 1: resolver a conversa ──────────────────────────────────────
      const { data: convData, error: convError, status: convStatus } =
        await client
          .from("conversations")
          .upsert(
            {
              profile_id: context.userId,
              organization_id: context.organizationId,
              wa_chat_id: context.waChatId,
              contact_name: context.contactName ?? null,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "profile_id,wa_chat_id" },
          )
          .select("id")
          .limit(1);

      if (convError || !convData || convData.length === 0) {
        if (convStatus === 401 || convStatus === 403) {
          onError({ kind: "auth", message: convError?.message ?? "Sessão expirada" });
          isFlushInProgress = false;
          return;
        }
        throw new Error(convError?.message ?? "Conversa não resolvida");
      }

      const conversationId = (convData[0] as { id: string }).id;

      // ── Passo 2: enviar mensagens em lote idempotente ─────────────────────
      const messageBatch = valid.map((dto) => ({
        conversation_id: conversationId,
        organization_id: context.organizationId,
        wa_message_id: dto.waMessageId,
        from_me: dto.fromMe,
        kind: dto.kind,
        content: dto.content,
        sender: dto.sender ?? (dto.fromMe ? "advogado" : "lead"),
        sent_at: dto.sentAt ?? null,
      }));

      const { error: msgError, status: msgStatus } = await client
        .from("messages")
        .upsert(messageBatch, {
          onConflict: "conversation_id,wa_message_id",
          ignoreDuplicates: true,
        });

      if (msgError) {
        if (msgStatus === 401 || msgStatus === 403) {
          onError({ kind: "auth", message: msgError.message });
          isFlushInProgress = false;
          return;
        }
        throw new Error(msgError.message);
      }

      // ── Sucesso: marcar como enviados e limpar todos os pendentes ────────
      // Limpar todos os DTOs do lote (válidos foram enviados; inválidos foram
      // descartados pelo schema — não tentar re-enviar infinitamente).
      for (const dto of dtos) {
        pending.delete(dto.waMessageId);
      }
      for (const dto of valid) {
        sentIds.add(dto.waMessageId);
      }
      flushAttempt = 0; // reset do backoff
    } catch (err) {
      flushAttempt += 1;
      const backoffMs = computeBackoff(flushAttempt - 1, backoffCap);

      // Notificar sem incluir conteúdo da mensagem (LGPD T-02-21)
      onError({ kind: "network", error: err, attempt: flushAttempt });

      // Agendar retry com backoff
      setTimeout(() => {
        void doFlush();
      }, backoffMs);
    } finally {
      isFlushInProgress = false;
    }
  }

  return {
    enqueue(dtos: MessageDTO[]): void {
      let newItems = false;
      for (const dto of dtos) {
        // Ignorar: já enviado ou já pendente com o mesmo id (dedup local)
        if (sentIds.has(dto.waMessageId) || pending.has(dto.waMessageId)) continue;
        pending.set(dto.waMessageId, dto);
        newItems = true;
      }

      if (!newItems) return;

      // Flush imediato ao atingir o tamanho do lote
      if (pending.size >= batchSize) {
        cancelFlush();
        void doFlush();
        return;
      }

      // Agendar flush automático (debounce)
      scheduleFlush();
    },

    async flush(): Promise<void> {
      cancelFlush();
      await doFlush();
    },
  };
}
