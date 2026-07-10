import { Resend } from "resend";

import type { EmailPayload } from "./console";

export async function sendResendEmail(payload: EmailPayload) {
  const apiKey = process.env.RESEND_API_KEY;
  const fromName = process.env.EMAIL_FROM_NAME ?? "Elite Juris";
  const fromAddress =
    process.env.EMAIL_FROM_ADDRESS ?? "nao-responda@elitejuris.com.br";

  if (!apiKey) {
    throw new Error("Missing RESEND_API_KEY for EMAIL_DRIVER=resend.");
  }

  const resend = new Resend(apiKey);

  await resend.emails.send({
    from: `${fromName} <${fromAddress}>`,
    to: payload.to,
    subject: payload.subject,
    html: payload.html
  });
}
