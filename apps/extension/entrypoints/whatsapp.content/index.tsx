import "./style.css";
import ReactDOM from "react-dom/client";
import type { ContentScriptContext } from "wxt/utils/content-script-context";

import { App } from "./panel/App";
import {
  PANEL_WIDTH_COLLAPSED,
  PANEL_WIDTH_EXPANDED,
} from "./panel/PanelShell";
import { PanelProvider } from "./panel/store";
import { getExtensionEnv } from "./sync/env";
import { checkProfileStatus, restoreSession } from "./sync/session";

/** Chave da persistência do estado aberto/recolhido do painel (D-06). */
const PANEL_OPEN_KEY = "copiloto_panel_open";

/**
 * Aguarda a âncora raiz do app do WhatsApp existir antes de montar o painel
 * (#app — confirmada no 02-SPIKE.md). A tela de QR/loading pode demorar —
 * ausência da âncora significa "ainda não montar"/estado wa_desconectado,
 * NUNCA quebra (Pitfall 2 do 02-RESEARCH.md). Poll leve com setTimeout
 * recursivo, cancelado se o contexto do content script for invalidado.
 */
function waitForWhatsAppRoot(ctx: ContentScriptContext): Promise<HTMLElement | null> {
  const POLL_INTERVAL_MS = 500;
  return new Promise((resolve) => {
    const check = () => {
      if (ctx.isInvalid) {
        resolve(null);
        return;
      }
      const root = document.querySelector<HTMLElement>("#app");
      if (root) {
        resolve(root);
        return;
      }
      ctx.setTimeout(check, POLL_INTERVAL_MS);
    };
    check();
  });
}

/** D-06: ausente = true (aberto no primeiro uso); depois persiste a escolha. */
async function readPanelOpen(): Promise<boolean> {
  const result = await chrome.storage.local.get(PANEL_OPEN_KEY);
  const value = result[PANEL_OPEN_KEY];
  return typeof value === "boolean" ? value : true;
}

function persistPanelOpen(open: boolean): void {
  void chrome.storage.local.set({ [PANEL_OPEN_KEY]: open });
}

/**
 * Reserva de largura: comprime o WhatsApp em 360px (expandido) ou 40px
 * (recolhido) para o painel NUNCA sobrepor o chat (UI-SPEC/EXT-01).
 *
 * EXCEÇÃO DOCUMENTADA DE ESCRITA (EXT-08, Pattern 8 do 02-RESEARCH.md):
 * esta é a mutação permitida nº 2 da lista fechada (a nº 1 é o host do
 * próprio painel criado pelo createShadowRootUi). É um ajuste de estilo
 * inline no elemento raiz do app do WhatsApp — não toca a árvore da
 * conversa, o campo de texto, nem dispara eventos.
 */
function applyWidthReservation(waRoot: HTMLElement, collapsed: boolean): void {
  const width = collapsed ? PANEL_WIDTH_COLLAPSED : PANEL_WIDTH_EXPANDED;
  waRoot.style.marginRight = `${width}px`;
}

function clearWidthReservation(waRoot: HTMLElement): void {
  waRoot.style.marginRight = "";
}

/**
 * "Esqueci minha senha": abre `${WXT_WEB_APP_URL}/recuperar-senha` (fluxo web
 * da Fase 1) em nova aba — a extensão não reimplementa reset de senha
 * (contrato do UI-SPEC). A URL vem de getExtensionEnv() (WXT_WEB_APP_URL).
 * window.open não exige a permissão tabs, mantendo o manifest mínimo
 * (D-12/Pattern 8).
 */
function openPasswordRecovery(): void {
  try {
    const { webAppUrl } = getExtensionEnv();
    window.open(`${webAppUrl}/recuperar-senha`, "_blank", "noopener");
  } catch (err) {
    console.error("[copiloto] Não foi possível abrir a recuperação de senha:", err);
  }
}

export default defineContentScript({
  matches: ["*://web.whatsapp.com/*"],
  cssInjectionMode: "ui",

  async main(ctx) {
    const waRoot = await waitForWhatsAppRoot(ctx);
    if (!waRoot) return; // contexto invalidado antes do WhatsApp carregar

    // Boot da sessão (AUTH-02/D-10): restaura do chrome.storage.local.
    // Erro de refresh/401 → sem sessão → view "deslogado" (Pitfall 3).
    const session = await restoreSession();

    // D-11: com sessão, verifica remoção ANTES de exibir controles.
    // Select vazio ou status removed → view "removido"; erro de rede NÃO
    // desloga nem marca removido (o heartbeat do 02-06 re-verifica).
    let profileRemoved = false;
    if (session) {
      const profile = await checkProfileStatus(session.user.id);
      profileRemoved = profile.kind === "removed";
    }

    // D-06: aberto no primeiro uso; depois lembra a última escolha.
    const panelOpen = await readPanelOpen();
    let collapsed = !panelOpen;

    applyWidthReservation(waRoot, collapsed);
    ctx.onInvalidated(() => clearWidthReservation(waRoot));

    const handleCollapsedChange = (next: boolean) => {
      collapsed = next;
      persistPanelOpen(!next);
      applyWidthReservation(waRoot, next);
    };

    const ui = await createShadowRootUi(ctx, {
      name: "copiloto-panel",
      position: "inline",
      anchor: "body",
      onMount(container) {
        const app = document.createElement("div");
        container.append(app);
        const reactRoot = ReactDOM.createRoot(app);
        reactRoot.render(
          <PanelProvider
            initialSession={session}
            initialProfileRemoved={profileRemoved}
            initialCollapsed={collapsed}
            onCollapsedChange={handleCollapsedChange}
            onForgotPassword={openPasswordRecovery}
          >
            <App />
          </PanelProvider>,
        );
        return reactRoot;
      },
      onRemove(reactRoot) {
        reactRoot?.unmount();
      },
    });

    ui.mount();

    // Coletor de diagnóstico do spike — APENAS em dev (T-02-03: o build de
    // produção não inclui este módulo; o guard DEV é eliminado pelo bundler).
    if (import.meta.env.DEV) {
      const { registerSpikeCollector } = await import("./spike/collector");
      registerSpikeCollector();
    }
  },
});
