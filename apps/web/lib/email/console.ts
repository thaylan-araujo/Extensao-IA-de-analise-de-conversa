export type EmailPayload = {
  to: string;
  subject: string;
  html: string;
};

function extractFirstLink(html: string) {
  return html.match(/https?:\/\/[^"'<\s]+/)?.[0] ?? null;
}

export async function sendConsoleEmail(payload: EmailPayload) {
  const link = extractFirstLink(payload.html);

  console.info("[email:console]", {
    to: payload.to,
    subject: payload.subject,
    link
  });
}
