# Fixtures do parser (capturas reais do WhatsApp Web)

Os arquivos `.html` desta pasta são capturas **REAIS** do DOM do WhatsApp Web,
feitas durante o spike da Fase 2 (ver `02-SPIKE.md` na pasta da fase) via
`__copilotoSpike.captureRow(n)` / `captureHeader()`.

**Sanitização obrigatória antes de commitar:** nomes reais são substituídos por
`Contato Teste` e telefones por `5511900000000`, preservando integralmente a
estrutura e os atributos do HTML (`data-id`, `data-pre-plain-text`, classes).

Estas fixtures são a **rede de proteção contra drift de seletor**: os testes de
regressão do parser (plano 02-04, `extract.test.ts`) rodam contra este HTML.
Quando o WhatsApp mudar o DOM e quebrar a extração, recapturar as fixtures no
WhatsApp real e ajustar `reader/selectors.ts` até a suíte voltar a passar.

Arquivos esperados:

| Arquivo | Conteúdo |
|---------|----------|
| `msg-in-text.html` | Linha de mensagem de texto RECEBIDA (conversa individual) |
| `msg-out-text.html` | Linha de mensagem de texto ENVIADA |
| `msg-audio.html` | Linha de mensagem de áudio/voz |
| `msg-image.html` | Linha de mensagem de imagem |
| `msg-document.html` | Linha de mensagem de documento |
| `msg-group.html` | Linha de mensagem em GRUPO (detector `@g.us` — D-02) |
| `header.html` | Header do `#main` (nome do contato — A8) |
