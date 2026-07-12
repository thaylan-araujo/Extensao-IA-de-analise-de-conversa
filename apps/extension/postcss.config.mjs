// Mesma convenção da Fase 1 (apps/web): Tailwind 4 via plugin PostCSS.
// O pacote @tailwindcss/postcss@4.3.2 já foi auditado/aprovado na Fase 1 (mesmo repo oficial do tailwindcss).
const config = {
  plugins: {
    "@tailwindcss/postcss": {}
  }
};

export default config;
