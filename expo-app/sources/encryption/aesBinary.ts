/**
 * Binary AES-256-GCM encryption/decryption using WebCrypto API
 * Encrypts raw binary data without JSON serialization overhead
 * Uses version byte 1 to distinguish from JSON-based encryption (version 0)
 *
 * Bundle format: version(1) + nonce(12) + ciphertext + authTag(16)
 * This matches the CLI's encryptBinaryWithDataKey format exactly
 */

import { decodeBase64, encodeBase64 } from './base64';

/**
 * Encrypt binary data using AES-256-GCM
 * @param data - Raw binary data to encrypt
 * @param keyBase64 - Base64-encoded 32-byte AES key
 * @returns Base64-encoded encrypted bundle with version byte 1
 */
export async function encryptBinaryAESGCM(data: Uint8Array, keyBase64: string): Promise<string> {
    const keyBytes = decodeBase64(keyBase64);
    const key = await crypto.subtle.importKey('raw', keyBytes.buffer as ArrayBuffer, { name: 'AES-GCM' }, false, ['encrypt']);

    const nonce = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, data.buffer as ArrayBuffer);

    // WebCrypto appends the 16-byte auth tag to the ciphertext
    const encryptedBytes = new Uint8Array(encrypted);

    // Bundle: version(1=binary) + nonce(12) + ciphertext_with_tag
    const bundle = new Uint8Array(1 + 12 + encryptedBytes.length);
    bundle[0] = 1; // Version 1 = binary
    bundle.set(nonce, 1);
    bundle.set(encryptedBytes, 13);

    return encodeBase64(bundle);
}

/**
 * Decrypt binary data encrypted with AES-256-GCM
 * @param encryptedBase64 - Base64-encoded encrypted bundle (must have version byte 1)
 * @param keyBase64 - Base64-encoded 32-byte AES key
 * @returns Decrypted binary data or null if decryption fails
 */
export async function decryptBinaryAESGCM(encryptedBase64: string, keyBase64: string): Promise<Uint8Array | null> {
    try {
        const bundle = decodeBase64(encryptedBase64);

        if (bundle.length < 1 + 12 + 16) { // version + nonce + min auth tag
            return null;
        }

        if (bundle[0] !== 1) { // Only version 1 (binary)
            return null;
        }

        const nonce = bundle.slice(1, 13);
        const ciphertextWithTag = bundle.slice(13);

        const keyBytes = decodeBase64(keyBase64);
        const key = await crypto.subtle.importKey('raw', keyBytes.buffer as ArrayBuffer, { name: 'AES-GCM' }, false, ['decrypt']);

        const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: nonce },
            key,
            ciphertextWithTag.buffer as ArrayBuffer
        );

        return new Uint8Array(decrypted);
    } catch (error) {
        return null;
    }
}
