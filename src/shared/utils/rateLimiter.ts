const RATE_LIMIT_KEY = "last_sensitive_op";
const COOLDOWN_MS = 120000; // 2 minutes
const MAX_ATTEMPTS = 3;

export const checkRateLimit = (operation: string): boolean => {
  const now = Date.now();
  const history = JSON.parse(localStorage.getItem(RATE_LIMIT_KEY) || "{}");
  const attempts = history[operation] || [];

  // Filter attempts older than the cooldown
  const recentAttempts = attempts.filter((t: number) => now - t < COOLDOWN_MS);

  if (recentAttempts.length >= MAX_ATTEMPTS) {
    return false; // Blocked
  }

  // Record attempt
  recentAttempts.push(now);
  localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify({ ...history, [operation]: recentAttempts }));
  return true; // Allowed
};
