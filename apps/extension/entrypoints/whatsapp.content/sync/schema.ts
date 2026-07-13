/**
 * Schema Zod do boundary DOM → sync (plano 02-06, Task 2).
 *
 * Por que a validação vive na extensão e não em packages/shared?
 * Decisão 02-02: `MessageDTO` em shared é o tipo TypeScript compartilhado;
 * o schema Zod (validação de runtime) pertence à extensão que produz o dado —
 * o conteúdo do DOM do WhatsApp é input não confiável (ASVS V5, T-02-22).
 *
 * O schema espelha MessageDTO de @copiloto/shared mas com validação de runtime:
 * - waMessageId: string não-vazia (chave de dedup — sem ela não há idempotência)
 * - waChatId: string não-vazia (identidade da conversa)
 * - fromMe: boolean
 * - kind: literal union validado
 * - content: string (marcadores [áudio]/[imagem]/[documento]/[não suportado])
 * - sender: string | null
 * - sentAt: string | null (ISO 8601 quando presente)
 */
import { z } from "zod";

export const messageDtoSchema = z.object({
  waMessageId: z.string().min(1, "waMessageId não pode ser vazio"),
  waChatId: z.string().min(1, "waChatId não pode ser vazio"),
  fromMe: z.boolean(),
  kind: z.enum(["text", "audio", "image", "document", "other"]),
  content: z.string(),
  sender: z.string().nullable(),
  sentAt: z.string().nullable(),
});

export type ValidatedMessageDTO = z.infer<typeof messageDtoSchema>;

/**
 * Valida um array de DTOs, retornando apenas os válidos.
 * DTOs inválidos são descartados com um aviso de metadados (nunca o conteúdo —
 * LGPD T-02-21). A lista de descartados não inclui o conteúdo da mensagem.
 */
export function filterValidDtos(
  dtos: unknown[],
): ValidatedMessageDTO[] {
  const valid: ValidatedMessageDTO[] = [];
  let discardedCount = 0;

  for (const dto of dtos) {
    const result = messageDtoSchema.safeParse(dto);
    if (result.success) {
      valid.push(result.data);
    } else {
      discardedCount += 1;
      // Aviso de metadados APENAS — nunca logar content (LGPD)
      // A lista de erros do Zod é sobre estrutura/tipos, não sobre o valor em si.
      const errorPaths = result.error.issues.map((i) => i.path.join(".")).join(", ");
      console.warn(
        `[copiloto/sync] DTO descartado por validação Zod — campos inválidos: ${errorPaths}`,
      );
    }
  }

  if (discardedCount > 0) {
    console.warn(`[copiloto/sync] ${discardedCount} DTO(s) descartado(s) no ciclo atual.`);
  }

  return valid;
}
