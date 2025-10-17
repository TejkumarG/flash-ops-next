import crypto from 'crypto';

if (!process.env.ENCRYPTION_KEY) {
  throw new Error('Please add ENCRYPTION_KEY to .env.local (generate with: openssl rand -hex 32)');
}

const ALGORITHM = 'aes-256-cbc';
const ENCRYPTION_KEY = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');

if (ENCRYPTION_KEY.length !== 32) {
  throw new Error('ENCRYPTION_KEY must be 32 bytes (64 hex characters). Generate with: openssl rand -hex 32');
}

/**
 * Encrypt text using AES-256-CBC
 * Returns format: "iv:encryptedText" (both in hex)
 *
 * @param plaintext - The text to encrypt
 * @returns Encrypted string in format "iv:ciphertext"
 */
export function encrypt(plaintext: string): string {
  try {
    // Generate random IV (Initialization Vector)
    const iv = crypto.randomBytes(16);

    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);

    // Encrypt the text
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Return IV:encrypted format
    return `${iv.toString('hex')}:${encrypted}`;
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Decrypt text encrypted with AES-256-CBC
 * Expects format: "iv:encryptedText" (both in hex)
 *
 * @param ciphertext - The encrypted string in format "iv:ciphertext"
 * @returns Decrypted plaintext string
 */
export function decrypt(ciphertext: string): string {
  try {
    // Split IV and encrypted text
    const parts = ciphertext.split(':');

    if (parts.length !== 2) {
      throw new Error('Invalid encrypted text format');
    }

    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];

    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);

    // Decrypt the text
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt data');
  }
}

/**
 * Hash a password using crypto (for additional security layer)
 * Note: Primary password hashing should use bcrypt in the User model
 * This is for additional application-level hashing if needed
 *
 * @param password - Password to hash
 * @returns Hashed password
 */
export function hashPassword(password: string): string {
  return crypto
    .createHash('sha256')
    .update(password)
    .digest('hex');
}

/**
 * Generate a secure random token
 * Useful for API keys, reset tokens, etc.
 *
 * @param length - Length in bytes (default: 32)
 * @returns Hex string of random bytes
 */
export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Compare two strings in constant time to prevent timing attacks
 * Useful for comparing tokens, secrets, etc.
 *
 * @param a - First string
 * @param b - Second string
 * @returns True if strings match
 */
export function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);

  return crypto.timingSafeEqual(bufA, bufB);
}
