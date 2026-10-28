import 'dotenv/config';
import crypto from 'crypto';
import { errorHandler } from '../libraries/handler.js';

const ALGORITHM = 'aes-256-gcm';
const DEFAULT_FALLBACK_KEY = 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90';

// Ensure you have HMAC_SECRET in your .env
const HMAC_SECRET = process.env.HMAC_SECRET || 'abcdefgh12345678abcdefgh12345678'; 

// Ensure your ENCRYPTION_KEY is a 32-byte (256-bit) hex or base64 string stored in .env
export function getEncryptionKey() {
    try {
        const envKey = process.env.ENCRYPTION_KEY;

        // Check if ENCRYPTION_KEY exists and is a valid 64-character hex string (32 bytes)
        if (envKey) {
            const is64HexChars = /^[0-9a-fA-F]{64}$/.test(envKey.trim());
            
            if (is64HexChars) {
                return Buffer.from(envKey.trim(), 'hex');
            }

            console.warn(
                `[SECURITY WARNING] ENCRYPTION_KEY in .env must be 64 hex characters (32 bytes). ` +
                `Received length: ${envKey.length}. Falling back to default encryption key.`
            );
        } else {
            console.warn('[SECURITY WARNING] ENCRYPTION_KEY is missing in .env. Falling back to default key.');
        }

        return Buffer.from(DEFAULT_FALLBACK_KEY, 'hex');
    } catch (error) {
        errorHandler( error , 'crypto.ts', `Check Encryption Key failed`);
        return Buffer.from(DEFAULT_FALLBACK_KEY, 'hex');
    }
}

export function generateBlindIndex(text) {
    if (!text) return null;
    try {
        return crypto.createHmac('sha256', HMAC_SECRET)
                    .update(text.toLowerCase().trim())
                    .digest('hex');
    } catch (error) {
        errorHandler( error , 'crypto.ts', `Generate blindIndex failed`);
        throw new Error(`Failed to generate blind index: ${error.message}`);
    }
}

export function encrypt(text) {
    if (!text) return text;
    try {
        const iv = crypto.randomBytes(12); // 12 bytes IV is standard for GCM
        const SECRET_KEY = getEncryptionKey();
        const cipher = crypto.createCipheriv(ALGORITHM, SECRET_KEY, iv);
        
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        const authTag = cipher.getAuthTag().toString('hex');
        
        // Store IV, AuthTag, and Encrypted payload together separated by colons
        return `${iv.toString('hex')}:${authTag}:${encrypted}`;
    } catch (error) {
        errorHandler( error , 'crypto.ts', `Encryption failed`);
        throw new Error(`Failed to encrypt data: ${error.message}`);
    }
}

export function decrypt(encryptedText) {
    try {
        console.log(encryptedText)
        if (!encryptedText) return encryptedText;
        const parts = encryptedText.split(':');
        if (parts.length !== 3) return encryptedText; // Fallback if data isn't encrypted format

        const [ivHex, authTagHex, encryptedData] = parts;
        const iv = Buffer.from(ivHex, 'hex');
        const authTag = Buffer.from(authTagHex, 'hex');
        const SECRET_KEY = getEncryptionKey();
        const decipher = crypto.createDecipheriv(ALGORITHM, SECRET_KEY, iv);
        
        decipher.setAuthTag(authTag);
        
        let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        return decrypted;
    } catch (error) {
        errorHandler( error , 'crypto.ts', `Decryption failed`);
        throw new Error(`Failed to decrypt data: ${error.message}`);
    }
}