import "./style.css";
import ReactDOM from "react-dom/client";
import type { ContentScriptContext } from "wxt/utils/content-script-context";

/**
 * Placeholder provisório do painel — o painel real (login, lead, estados do
 * 02-UI-SPEC.md) chega no plano 02-03. Aqui só provamos que o host em Shadow DOM
 * monta sobre o WhatsApp Web sem quebrar a página (EXT-01).
 */
function App() {
  return (
    <div
      style={{
        position: "fixed",
        top: 8,
        right: 8,
        zIndex: 2147483647,
        background: "#ffffff",
        border: "1px solid #e5e7eb",
        borderRadius: 8,
        padding: "8px 16px",
        fontSize: 14,
        fontWeight: 600,
        boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
      }}
    >
      Copiloto Jurídico
    </div>
  );
}

/**
 * Aguarda a âncora raiz do app do WhatsApp existir antes de montar o painel.
 * A tela de QR/loading pode demorar — ausência da âncora significa "ainda não
 * montar", nunca erro (Pitfall 2 do 02-RESEARCH.md). Poll leve com setTimeout
 * recursivo, cancelado se o contexto do content script for invalidado.
 */
function waitForWhatsAppRoot(ctx: ContentScriptContext): Promise<Element | null> {
  const POLL_INTERVAL_MS = 500;
  return new Promise((resolve) => {
    const check = () => {
      if (ctx.isInvalid) {
        resolve(null);
        return;
      }
      // #app é o container raiz onde o WhatsApp Web monta a SPA.
      const root = document.querySelector("#app");
      if (root) {
        resolve(root);
        return;
      }
      ctx.setTimeout(check, POLL_INTERVAL_MS);
    };
    check();
  });
}

export default defineContentScript({
  matches: ["*://web.whatsapp.com/*"],
  cssInjectionMode: "ui",

  async main(ctx) {
    const root = await waitForWhatsAppRoot(ctx);
    if (!root) return; // contexto invalidado antes do WhatsApp carregar

    const ui = await createShadowRootUi(ctx, {
      name: "copiloto-panel",
      position: "inline",
      anchor: "body",
      onMount(container) {
        const app = document.createElement("div");
        container.append(app);
        const reactRoot = ReactDOM.createRoot(app);
        reactRoot.render(<App />);
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
