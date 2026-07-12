export type UserRole = "super_admin" | "gestor" | "advogado";

export type ProfileStatus = "active" | "removed";

export type InvitationStatus = "pending" | "accepted" | "cancelled" | "expired";

export type MessageKind = "text" | "audio" | "image" | "document" | "other";

export type ReaderHealth = "ok" | "drift" | "broken";

export interface MessageDTO {
  waMessageId: string;
  waChatId: string;
  fromMe: boolean;
  kind: MessageKind;
  content: string;
  sender: string | null;
  sentAt: string | null;
}

export type { Database, Json } from "./database.types";
