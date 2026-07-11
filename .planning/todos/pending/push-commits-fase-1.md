---
created: 2026-07-11
title: git push dos commits da Fase 1 (CI + backup)
area: infra
---

18+ commits locais à frente de origin/main (fundação completa da Fase 1, incl. migration `20260711020000_auth_admin_profiles_policy.sql` e fixes CR-01/CR-02). O push:
- roda o CI (db-tests pgTAP) sobre a migration nova e o teste de regressão do open redirect
- serve de backup do trabalho (hoje só existe nesta máquina)

Risco de adiar: baixo (migration aditiva já aplicada no hosted), mas quanto antes melhor pelo backup. Claude pode executar a pedido.
