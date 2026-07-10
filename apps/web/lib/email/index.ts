import type { EmailPayload } from "./console";
import { sendConsoleEmail } from "./console";
import { sendResendEmail } from "./resend";

export type { EmailPayload };

export async function sendEmail(payload: EmailPayload) {
  const driver = process.env.EMAIL_DRIVER ?? "console";

  if (driver === "resend") {
    return sendResendEmail(payload);
  }

  if (driver !== "console") {
    throw new Error(`Unsupported EMAIL_DRIVER: ${driver}`);
  }

  return sendConsoleEmail(payload);
}
