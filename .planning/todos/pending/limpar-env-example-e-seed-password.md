---
created: 2026-07-11
title: Limpar senha do .env.example e definir SEED_USER_PASSWORD no .env.local
area: seguranca-local
---

**Ação do dono (30s):**
1. Abrir `.env.example` e apagar o valor de `SEED_USER_PASSWORD=` (deixar vazio) — arquivo é versionado, senha real não pode ficar nele. Proteção temporária ativa: `git update-index --skip-worktree .env.example` (reverter com `--no-skip-worktree` após limpar).
2. Abrir `.env.local` da RAIZ e colocar em `SEED_USER_PASSWORD=` a senha atual do gestor demo (a definida no reset do checkpoint da Fase 1).

**Efeito:** destrava `tests/skeleton.test.ts` local (hoje vermelho por senha divergente) — suíte volta a 31/31.
