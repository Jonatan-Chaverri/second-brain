import { env } from "@/lib/env";

export function isOwnerEmail(email: string | null | undefined) {
  return (email ?? "").toLowerCase() === env.ownerEmail;
}
