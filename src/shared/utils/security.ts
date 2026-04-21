/**
 * Security utilities for masking sensitive data and handling token-related logic.
 */

/**
 * Masks an email address for display.
 * e.g., "john.doe@example.com" -> "j***e@example.com"
 */
export function maskEmail(email?: string): string {
  if (!email) return "Unknown";
  const [local, domain] = email.split("@");
  if (!domain) return email;
  if (local.length <= 2) return `${local[0]}***@${domain}`;
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}

/**
 * Masks a sensitive string like an API key.
 * e.g., "AIzaSyAJwMmPs75DEpxa" -> "AIza...epxa"
 */
export function maskSecret(secret?: string, visibleChars = 4): string {
  if (!secret) return "****";
  if (secret.length <= visibleChars * 2) return "****";
  return `${secret.slice(0, visibleChars)}...${secret.slice(-visibleChars)}`;
}

/**
 * Generates a temporary session token for internal use.
 * Note: This is NOT a replacement for Firebase Auth tokens.
 */
export function generateSessionToken(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

/**
 * Verifies if a token has expired based on a timestamp.
 */
export function isTokenExpired(timestamp: string, expiryMinutes: number): boolean {
  const created = new Date(timestamp).getTime();
  const now = new Date().getTime();
  const diffInMinutes = (now - created) / 1000 / 60;
  return diffInMinutes > expiryMinutes;
}
