const MAX_TEXT_LENGTH = 120;
const MAX_MESSAGE_LENGTH = 500;

export function sanitizeText(value: string, maxLength = MAX_TEXT_LENGTH) {
  return value.replace(/\s+/g, " ").replace(/[<>]/g, "").trim().slice(0, maxLength);
}

export function sanitizeMultilineText(value: string, maxLength = MAX_MESSAGE_LENGTH) {
  return value.replace(/[<>]/g, "").trim().slice(0, maxLength);
}

export function requireText(value: string, fieldName: string, maxLength = MAX_TEXT_LENGTH) {
  const sanitized = sanitizeText(value, maxLength);
  if (!sanitized) {
    throw new Error(`${fieldName} is required.`);
  }
  return sanitized;
}

export function requirePositiveNumber(value: number, fieldName: string) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${fieldName} must be greater than zero.`);
  }
  return value;
}

export function validateEmailAddress(value: string) {
  const sanitized = sanitizeText(value, 120).toLowerCase();
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(sanitized)) {
    throw new Error("A valid email address is required.");
  }
  return sanitized;
}
