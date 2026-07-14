---
phase: 02-extens-o-chrome-e-leitura-do-whatsapp
plan: 07
status: complete
completed_at: 2026-07-13
---

# 02-07 Summary — Build Produção + Verificação E2E + Chrome Web Store

## Goal Achievement

Todos os must_haves atendidos:
- Build de produção gerado (519.92 kB, chrome-mv3)
- 5 success criteria da fase confirmados no WhatsApp real pelo dono
- Extensão submetida à Chrome Web Store como não listada (status: aguardando revisão)

## E2E Checkpoint Results

| Bloco | Resultado |
|-------|-----------|
| Block 2: Login + painel | ✅ Painel apareceu, login funcionou |
| Block 3: Mensagens no Supabase | ✅ Mensagens sincronizadas, múltiplos tipos (text/audio/image/document) |
| Block 4: Kill-switch | ✅ `app_settings.reader_enabled = false` pausou leitura + exibiu aviso correto |
| Block 5: Performance | ✅ WhatsApp fluido, sem travamentos |
| Block 6: Remoção | ⏭️ Pulado (preservar conta demo) |

## Bugs Encontrados e Corrigidos

Três bugs descobertos durante o checkpoint humano:

**Bug 1 — Race condition (index.tsx)**
`startObservers()` era chamado antes de `ui.mount()`. O `requestIdleCallback` da
extração inicial disparava antes do `useEffect` do `PanelProvider` definir
`setReaderInputsCb`, perdendo a atualização silenciosamente.
Fix: mover `startObservers()` para dentro do callback `onSetReaderInputsRef`.

**Bug 2 — Multiple GoTrueClient (index.tsx)**
`createExtensionClient()` criava uma segunda instância Supabase competindo com
o singleton de `session.ts` pela mesma chave `copiloto_auth`.
Fix: usar `supabase` singleton diretamente.

**Bug 3 — Observer no pai errado (observers.ts)**
`conversationObserver.observe(appRoot.element, { childList: true, subtree: false })`
observava `#app` raso, mas `#main` não é filho direto de `#app`.
Fix: observar `main.element.parentElement` dinamicamente; `subtree: true` apenas
enquanto `#main` não existe.

## UI Polish (pré-submissão CWS)

- Largura expandida: 360px → 300px
- Fix sobreposição: `marginRight` → `width: calc(100vw - Xpx)` no `#app`
- Estado inicial: expandido → recolhido (40px)
- Header: email do usuário removido

## Chrome Web Store

- Conta de desenvolvedor criada (taxa $5 paga)
- Ícones placeholder gerados (16/32/48/128px, initials CJ)
- Screenshot placeholder 1280x800 gerado
- Zip final: `copiloto-juridico-0.1.0-chrome.zip` (152 KB)
- Status: **submetido para revisão** (unlisted) em 2026-07-13
- Revisão esperada: 1-3 dias úteis

## Seed Corrigido

`app_settings` não tinha a linha `reader_enabled` no banco de produção.
Inserido manualmente via SQL Editor:
```sql
INSERT INTO public.app_settings (key, value)
VALUES ('reader_enabled', 'true'::jsonb)
ON CONFLICT (key) DO NOTHING;
```

## Commits

- `5f88fee` docs: README extensão
- `a4cb3c8` fix: NODE_OPTIONS heap cap 512MB no zip script
- `610d97b` fix: três bugs E2E (race condition + GoTrueClient + observer target)
- `7078b5d` feat: ícones placeholder CWS
- `5203685` feat: UI polish pré-submissão CWS
