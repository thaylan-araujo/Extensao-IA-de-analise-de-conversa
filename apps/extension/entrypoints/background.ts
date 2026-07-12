// Background mínimo — o WXT exige um background entrypoint para MV3.
// Decisão do 02-RESEARCH.md: sem lógica de negócio aqui na v1 (o service worker
// MV3 morre após ~30s ocioso); o cliente Supabase vive no content script.
export default defineBackground(() => {
  // intencionalmente vazio
});
