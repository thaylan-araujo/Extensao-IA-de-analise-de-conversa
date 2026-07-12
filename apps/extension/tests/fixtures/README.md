# Fixtures do parser (capturas reais do WhatsApp Web)

Os arquivos `.html` desta pasta são capturas **REAIS** do DOM do WhatsApp Web,
feitas durante o spike da Fase 2 (ver `02-SPIKE.md` na pasta da fase) via
`__copilotoSpike.captureRow(n)` / `captureHeader()`.

**Sanitização obrigatória antes de commitar:** nomes reais substituídos por
`Contato Teste` (interlocutor) / `Advogado Teste` (dono da conta), telefones por
`+55 11 9000-0000`, `data-id` trocados por IDs fictícios de mesmo comprimento,
fotos CDN/base64/blob por placeholders — preservando integralmente a estrutura
e os atributos-âncora do HTML (`data-testid`, `data-pre-plain-text`, aria-labels, classes).

Estas fixtures são a **rede de proteção contra drift de seletor**: os testes de
regressão do parser (plano 02-04, `extract.test.ts`) rodam contra este HTML.
Quando o WhatsApp mudar o DOM e quebrar a extração, recapturar as fixtures no
WhatsApp real e ajustar `reader/selectors.ts` até a suíte voltar a passar.

Arquivos (capturados no spike de 2026-07-12, WhatsApp Business Web, Chrome/macOS):

| Arquivo | Conteúdo |
|---------|----------|
| `msg-in-text.html` | Texto RECEBIDO (tail-in, pre-plain-text, selo IA `ai-label`, sem recibo) |
| `msg-out-text.html` | Texto ENVIADO (tail-out, `aria-label="Você:"`, multi-linha, status " Entregue ") |
| `msg-out-text-enviada.html` | Texto ENVIADO com status " Enviada " (1 tique) e SEM tail |
| `msg-audio.html` | Voz ENVIADA (SEM `data-pre-plain-text`; duração via texto `0:36` e slider aria-valuetext) |
| `msg-in-audio.html` | Voz RECEBIDA (tail-in, remetente via aria-label com telefone, SEM recibo) |
| `msg-out-audio-forwarded.html` | Voz ENVIADA encaminhada — SEM tail e SEM "Você:"; from-me só pelo recibo em msg-meta |
| `msg-image.html` | Imagem ENVIADA com legenda (`image-thumb`, `image-caption selectable-text`, status " Lida ") |
| `msg-group.html` | Imagem RECEBIDA em GRUPO (`span[data-testid="author"]` — marcador exclusivo de grupo) |
| `msg-system.html` | Mensagem de SISTEMA (`msg-notification-container`/`system_message`) — parser deve IGNORAR |
| `header.html` | Header 1:1 (`conversation-header`, `conversation-info-header-chat-title`, SEM `chat-subtitle`) |
| `header-group.html` | Header de GRUPO (`chat-subtitle` com participantes + botão "Ligação de vídeo em grupo") |

**Gap conhecido:** `msg-document.html` NÃO foi capturado no spike (usuário não
tinha documento à mão). Capturar na primeira oportunidade durante o 02-04; até
lá o tipo documento segue a heurística descrita no `02-SPIKE.md`, sem fixture
de regressão.
