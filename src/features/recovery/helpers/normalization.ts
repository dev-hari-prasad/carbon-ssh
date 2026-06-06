/**
 * Normalizes a single recovery passphrase according to the strict normalization pipeline:
 * 1. Strip leading and trailing whitespace.
 * 2. Convert all text to NFC normalization format.
 * 3. Convert all text to lowercase.
 * 4. Remove punctuation, special characters, and non-alphanumeric marks (retaining spaces).
 * 5. Replace multiple spaces with a single space.
 */
export function normalizePassphrase(text: string): string {
  if (!text) return "";
  
  // 1. Strip leading/trailing whitespace and apply NFC normalization.
  let normalized = text.trim().normalize("NFC");
  
  // 2. Convert to lowercase.
  normalized = normalized.toLowerCase();
  
  // 3. Remove punctuation, special characters, and non-alphanumeric marks,
  // but keep spaces so word boundaries are preserved.
  normalized = normalized.replace(/[^\p{L}\p{N}\s]/gu, "");
  
  // 4. Replace multiple spaces/whitespace with a single space.
  normalized = normalized.replace(/\s+/g, " ");
  
  return normalized.trim();
}

/**
 * Normalizes and combines any number of answers with a strict ":" delimiter.
 */
export function combineAnswers(answers: string[]): string {
  return answers.map(normalizePassphrase).join(":");
}

/**
 * Normalizes and combines 3 recovery passphrases with a strict ":" delimiter.
 */
export function combinePassphrases(pass1: string, pass2: string, pass3: string): string {
  return combineAnswers([pass1, pass2, pass3]);
}
