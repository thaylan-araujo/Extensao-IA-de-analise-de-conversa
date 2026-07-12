import { defineConfig } from "wxt";

// Manifest MV3 mínimo (Pattern 8 do 02-RESEARCH.md / D-12):
// - permissions: SOMENTE "storage" (sem tabs, sem scripting, sem host_permissions)
// - o content script declara matches: ['*://web.whatsapp.com/*'] no próprio entrypoint
// Manifest mínimo = revisão mais rápida na Chrome Web Store e menor superfície de risco.
export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "Copiloto Jurídico",
    description:
      "Copiloto de IA para advogados no WhatsApp Web: acompanha a conversa ativa e orienta o fechamento de contratos.",
    permissions: ["storage"],
  },
});
