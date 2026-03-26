/**
 * Email Token Encryption — AES-256-GCM
 *
 * Encrypts/decrypts OAuth tokens for storage in email_accounts.
 * Format stored in BYTEA column: [16-byte IV][16-byte AuthTag][ciphertext]
 *
 * Requires EMAIL_ENCRYPTION_KEY env var (64-char hex string = 32 bytes).
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

// ---------------------------------------------------------------------------
// Key management
// ---------------------------------------------------------------------------

let _key = null;

function getKey() {
  if (_key) return _key;

  const hex = process.env.EMAIL_ENCRYPTION_KEY;
  if (!hex) {
    throw new Error(
      '[email/encryption] EMAIL_ENCRYPTION_KEY is not set. ' +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }

  if (hex.length !== 64) {
    throw new Error(
      `[email/encryption] EMAIL_ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes). Got ${hex.length} characters.`
    );
  }

  if (!/^[0-9a-fA-F]+$/.test(hex)) {
    throw new Error(
      '[email/encryption] EMAIL_ENCRYPTION_KEY must contain only hex characters (0-9, a-f, A-F).'
    );
  }

  _key = Buffer.from(hex, 'hex');
  return _key;
}

// ---------------------------------------------------------------------------
// Encrypt / Decrypt
// ---------------------------------------------------------------------------

/**
 * Encrypt a plaintext string into a Buffer suitable for BYTEA storage.
 * Output format: [16-byte IV][16-byte AuthTag][ciphertext]
 *
 * @param {string} plaintext - The string to encrypt
 * @returns {Buffer} Encrypted data with IV and auth tag prepended
 */
export function encrypt(plaintext) {
  if (typeof plaintext !== 'string' || plaintext.length === 0) {
    throw new Error('[email/encryption] encrypt() requires a non-empty string');
  }

  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  // [IV][AuthTag][Ciphertext]
  return Buffer.concat([iv, authTag, encrypted]);
}

/**
 * Decrypt a Buffer (from BYTEA storage) back to plaintext string.
 * Expects format: [16-byte IV][16-byte AuthTag][ciphertext]
 *
 * @param {Buffer} buffer - The encrypted data with IV and auth tag
 * @returns {string} Decrypted plaintext string
 */
export function decrypt(buffer) {
  // Supabase returns BYTEA as hex string (\x...) or base64 — coerce to Buffer
  if (typeof buffer === 'string') {
    if (buffer.startsWith('\\x')) {
      buffer = Buffer.from(buffer.slice(2), 'hex');
    } else {
      buffer = Buffer.from(buffer, 'base64');
    }
  }

  if (!Buffer.isBuffer(buffer)) {
    throw new Error('[email/encryption] decrypt() requires a Buffer or encoded string');
  }

  const minLength = IV_LENGTH + AUTH_TAG_LENGTH + 1; // at least 1 byte of ciphertext
  if (buffer.length < minLength) {
    throw new Error(
      `[email/encryption] decrypt() buffer too short (${buffer.length} bytes, minimum ${minLength})`
    );
  }

  const key = getKey();
  const iv = buffer.subarray(0, IV_LENGTH);
  const authTag = buffer.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = buffer.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

/**
 * Validate that the encryption key is configured correctly.
 * Call this at server startup to fail fast.
 *
 * @throws {Error} If EMAIL_ENCRYPTION_KEY is missing or invalid
 */
export function validateEncryptionKey() {
  getKey();
}
