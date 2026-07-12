/**
 * Casca do painel (D-07): flush na borda direita, 100vh.
 * Expandido: 360px. Recolhido: aba de 40px (CollapsedTab).
 * Transição APENAS de width, 200ms ease-out — nenhuma outra animação (UI-SPEC).
 * O WhatsApp é comprimido pela reserva de largura no index.tsx, nunca sobreposto.
 */
import type { ReactNode } from "react";

import { CollapsedTab } from "./CollapsedTab";
import { usePanel } from "./store";

/** Constantes de layout do 02-UI-SPEC.md — também usadas pela reserva de largura. */
export const PANEL_WIDTH_EXPANDED = 360;
export const PANEL_WIDTH_COLLAPSED = 40;

export function PanelShell({ children }: { children: ReactNode }) {
  const { collapsed } = usePanel();

  return (
    <aside
      className="fixed top-0 right-0 z-[2147483647] flex h-screen flex-col overflow-hidden border-l border-zinc-200 bg-white transition-[width] duration-200 ease-out"
      style={{
        width: collapsed ? PANEL_WIDTH_COLLAPSED : PANEL_WIDTH_EXPANDED,
      }}
    >
      {collapsed ? <CollapsedTab /> : children}
    </aside>
  );
}
