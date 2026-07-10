import { createHash, randomBytes } from "crypto";

export function generateApiToken(): string {
  return `nk_${randomBytes(24).toString("base64url")}`;
}

export function hashApiToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
