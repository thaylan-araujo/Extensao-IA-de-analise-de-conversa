# 02-SPIKE — Âncoras do DOM do WhatsApp Web validadas contra o app real

**Data:** 2026-07-12 · **Ambiente:** WhatsApp **Business** Web, Chrome/macOS, conta real do dono · **Método:** extensão dev (`apps/extension/.output/chrome-mv3-dev`) + coletor `window.__copilotoSpike()` (somente leitura)

> **Este arquivo é a FONTE DE VERDADE dos seletores** para o plano 02-04 (reader/parser). Ele substitui a tabela [ASSUMED] do Pattern 4 do 02-RESEARCH.md onde houver divergência. Fixtures HTML reais sanitizadas em `apps/extension/tests/fixtures/`.

## Saída bruta do `__copilotoSpike()` (conversa individual aberta)

```
{
  mainPresent: true,
  dataIdCount: 2,
  dataIdSamples: ['3EB0FD030D7C061FE4C6', '3EB0059E8B387B8E5351'],   // IDs reais truncados aqui
  headerTitleCandidates: ['Dados do perfil'],
  prePlainTextSamples: ['[15:56, 11/07/2026] Advogado Teste: '],
  selectableTextSamples: ['Olá, Contato Teste, tudo bem?\nAqui é o Advogado Teste...']
}
```

Sem conversa aberta: `mainPresent: false` e tudo zerado — confirma a máquina de estados do Pitfall 2 (ausência de `#main` ≠ quebra).

## Tabela de âncoras validadas

| # | Âncora assumida (RESEARCH) | Veredito | Seletor confirmado | Observações |
|---|---------------------------|----------|--------------------|-------------|
| A3 | `#main` (painel da conversa) | ✓ CONFIRMADA | `#main` | Só existe com conversa aberta; ausência = estado `sem_conversa`/`wa_desconectado`, nunca erro |
| A1 | `[data-id]` formato `{bool}_{chatId}@c.us_{hash}` | ✗ **DRIFT CONFIRMADO** | `[data-id]` (linha de mensagem) — valor agora é **hash puro** (ex.: `3EB0FD030D7C061FE4C6`) | Prefixo bool/chatId/`@c.us`/`@g.us` **NÃO existe mais**. Redundância nova: `data-testid="conv-msg-{id}"` no mesmo elemento. `wa_message_id` = hash puro (dedup continua válido — o id não muda em re-render) |
| A1b | from-me via prefixo `true_`/`false_` do data-id | ✗ substituir | **1º** `span[data-testid="tail-out"]` (enviada) / `tail-in` (recebida); **2º** `span[aria-label="Você:"]` (enviada) vs aria-label com telefone/nome (recebida); **fallback obrigatório**: presença de ícone de recibo em `[data-testid="msg-meta"]` (aria-label `" Enviada "`/`" Entregue "`/`" Lida "`) = enviada; recebidas nunca têm recibo | **Mensagens sem tail existem** (ex.: encaminhada em sequência — fixture `msg-out-audio-forwarded.html`); o fallback por recibo é o único critério universal observado |
| A2 | `data-pre-plain-text` formato `[HH:MM, DD/MM/AAAA] Nome: ` | ✓ CONFIRMADA (parcial) | `[data-pre-plain-text]` no `.copyable-text` | Presente em texto enviado/recebido e imagem com legenda. **AUSENTE em áudio (voz)** — horário do áudio sai de `[data-testid="msg-meta"] span` |
| A4 | Texto via `.copyable-text span.selectable-text` | ✓ CONFIRMADA | `span[data-testid="selectable-text"]` (também tem classes `selectable-text copyable-text`) | Multi-linha = spans internos `.x1lliihq` terminados em `\n` (classe ofuscada — usar `textContent` do span externo, não a classe) |
| A8 | Título do header (nome do contato) | ✓ via testid | `header[data-testid="conversation-header"]` → `span[data-testid="conversation-info-header-chat-title"]` | Os candidates do coletor pegaram o aria-label "Dados do perfil" do avatar — usar o testid, não `[title]` genérico |
| A6 | Grupo via `@g.us` no data-id | ✗ substituir | **Header:** `div[data-testid="chat-subtitle"]` (lista de participantes, ex.: "Contato Teste, Você") + botão `aria-label="Ligação de vídeo em grupo"`. **Row-level:** recebida em grupo tem `span[data-testid="author"]` (nome do remetente no balão) — nunca aparece em 1:1 | Header 1:1 NÃO mostrou `chat-subtitle` na captura (mas tratar presença de subtitle sozinha como sinal fraco — combinar com os outros dois). Enviada em grupo é idêntica a 1:1 |
| A7 | Heurísticas de mídia | ✓ mapeadas | Ver seção "Heurísticas de mídia" | Documento NÃO capturado (gap) |
| A5 | CORS: fetch do content script → Supabase | ✓ **CONFIRMADA** | — | Ver seção "CORS" |

## Heurísticas de mídia observadas

| Tipo | Âncoras |
|------|---------|
| **Áudio/voz** | `span[aria-label="Mensagem de voz"]` + botão `aria-label="Reproduzir mensagem de voz"` + duração como texto (`0:36`) e no slider `aria-valuetext="0:00/0:36"`. **Sem** `data-pre-plain-text`. Voz gravada tem avatar + `data-testid="ptt-status"`; voz encaminhada tem `data-testid="ptt-file"` |
| **Imagem** | `div[data-testid="image-thumb"]` com `aria-label="Abrir imagem"` + `div[data-testid="media-url-provider"]` (thumb base64 + blob). Legenda em `span[data-testid="image-caption selectable-text"]` (o `data-pre-plain-text` existe quando há legenda) |
| **Documento** | **NÃO CAPTURADO** no spike (usuário não tinha documento à mão). Gap conhecido — capturar fixture na primeira oportunidade durante o 02-04; até lá, classificar como documento por exclusão (tem msg-meta, sem texto/voz/imagem) com marcador `[documento]` e cobertura de teste adiada |

## Variantes e descobertas extras (não previstas no RESEARCH)

- **Mensagem de sistema:** `[data-testid="msg-notification-container"]` + `span[data-testid="system_message"]` (ex.: aviso Meta Business) — o parser deve **ignorar** (fixture `msg-system.html`)
- **Encaminhada:** `div[data-testid="forwarded-header"]` (texto "Encaminhada") — pode suprimir tail e o `aria-label="Você:"` da linha
- **Selo IA (WhatsApp Business):** `span[data-testid="ai-label"]` ("IA") + ícone `wds-ic-ai-filled` em msg-meta — mensagem gerada por IA; existe em conversas reais do nicho (fixture `msg-in-text.html`); relevante para o produto marcar origem
- **Status de entrega (só enviadas):** aria-label do ícone em `[data-testid="msg-meta"]`: `" Enviada "` (1 tique, `wds-ic-delivered`), `" Entregue "` / `" Lida "` (`wds-ic-read`; "Lida" adiciona classe de cor `x1rv0e52`)
- **`[data-testid="msg-meta"]`** presente em TODO tipo de mensagem (âncora universal de hora/status)
- **Contato não salvo:** título do header 1:1 vira "Número desconhecido" (fixture `header.html`) — não assumir que o título é sempre um nome

## CORS (A5) — fetch direto do content script → Supabase

```
await __copilotoSpike.testSupabaseCors()
→ GET https://<projeto>.supabase.co/rest/v1/  →  {status: 401, ok: false}
```

**Resposta HTTP chegou (401 = sem JWT, esperado) ⇒ CORS funciona do content script.** O cliente supabase-js pode viver no content script como planejado (Pattern 2). **Fallback via background NÃO é necessário.**

## Performance (linha de base EXT-07)

Usuário navegou e digitou durante toda a sessão de captura com a extensão dev ativa e não relatou travamento. Registro **informal** (sem medição de long tasks) — verificação formal fica no E2E do plano 02-07.

## Implicações para os próximos planos

**Para o 02-04 (reader/parser) — mudanças obrigatórias vs. RESEARCH:**
1. `wa_message_id` = `data-id` **hash puro** (dedup por `(conversation, wa_message_id)` continua válido).
2. **`wa_chat_id` perdeu a fonte primária** (o chatId não está mais no `data-id`). ⚠️ QUESTÃO ABERTA para o 02-04: derivar identidade da conversa de outra âncora — candidatos: título do header (instável: é display name; "Número desconhecido" para não salvos) ou outros atributos a investigar no DOM real durante a implementação. Se nenhuma âncora estável existir, documentar a limitação e usar título normalizado + heurística.
3. Detecção from-me: cadeia `tail-out/tail-in` → `aria-label "Você:"` → **fallback recibo em msg-meta** (único critério universal).
4. Detecção de grupo: substituir `@g.us` por `span[data-testid="author"]` (row) + `chat-subtitle`/botão "Ligação de vídeo em grupo" (header) — D-02.
5. Ignorar `system_message`; tratar `forwarded-header`; considerar `ai-label`.
6. Preferir `data-testid` (semânticos, abundantes nesta versão) na cadeia de seletores, com fallback para classes estáveis (`copyable-text`, `selectable-text`); **nunca** classes ofuscadas (`x1lliihq` etc.).
7. Áudio não tem `data-pre-plain-text`: horário via msg-meta; duração via `aria-valuetext` do slider.

**Para o 02-06 (sync):** fetch direto do content script confirmado (CORS OK) — sem proxy via background.

**Ressalva de generalização:** capturas feitas em WhatsApp **Business**. Âncoras `data-testid` tendem a ser comuns ao WhatsApp normal, mas `ai-label`/avisos Meta Business podem não existir lá — o parser não deve depender deles para o caminho principal.

## Gaps registrados

| Gap | Impacto | Ação |
|-----|---------|------|
| Fixture `msg-document.html` não capturada | Tipo documento sem teste de regressão | Capturar durante 02-04; heurística por exclusão até lá |
| Fonte estável de `wa_chat_id` indefinida (drift do data-id) | Identidade da conversa (D-02, dedup por conversa) | Investigar âncora no 02-04 antes de detalhar `selectors.ts` |
| Performance medida só informalmente | Baseline EXT-07 fraca | Medição formal no E2E do 02-07 |
