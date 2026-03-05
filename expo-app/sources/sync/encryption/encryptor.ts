import { decryptBox, decryptSecretBox, encryptBox, encryptSecretBox } from "@/encryption/libsodium";
import { encodeBase64, decodeBase64 } from "@/encryption/base64";
import sodium from '@/encryption/libsodium.lib';
import { decodeUTF8, encodeUTF8 } from "@/encryption/text";
import { decryptAESGCMString, encryptAESGCMString } from "@/encryption/aes";
import { encryptBinaryAESGCM, decryptBinaryAESGCM } from "@/encryption/aesBinary";

//
// IMPORTANT: Right now there is a bug in the AES implementation and it works only with a normal strings converted to Uint8Array. 
// Any abnormal string might break encoding and decoding utf8.
//

export interface Encryptor {
    encrypt(data: any[]): Promise<Uint8Array[]>;
}

export interface Decryptor {
    decrypt(data: Uint8Array[]): Promise<(any | null)[]>;
}

export interface BinaryEncryptor {
    encryptBinary(data: Uint8Array): Promise<string>;
    decryptBinary(encrypted: string): Promise<Uint8Array | null>;
}

export class SecretBoxEncryption implements Encryptor, Decryptor, BinaryEncryptor {
    private readonly secretKey: Uint8Array;

    constructor(secretKey: Uint8Array) {
        this.secretKey = secretKey;
    }

    async decrypt(data: Uint8Array[]): Promise<(any | null)[]> {
        // Process as batch, not Promise.all - more efficient
        const results: (any | null)[] = [];
        for (const item of data) {
            results.push(decryptSecretBox(item, this.secretKey));
        }
        return results;
    }

    async encrypt(data: any[]): Promise<Uint8Array[]> {
        // Process as batch, not Promise.all - more efficient
        const results: Uint8Array[] = [];
        for (const item of data) {
            results.push(encryptSecretBox(item, this.secretKey));
        }
        return results;
    }

    async encryptBinary(data: Uint8Array): Promise<string> {
        // Legacy: encrypt raw bytes with secretbox, return as base64
        const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
        const encrypted = sodium.crypto_secretbox_easy(data, nonce, this.secretKey);
        const bundle = new Uint8Array(nonce.length + encrypted.length);
        bundle.set(nonce);
        bundle.set(encrypted, nonce.length);
        return encodeBase64(bundle);
    }

    async decryptBinary(encrypted: string): Promise<Uint8Array | null> {
        try {
            const bundle = decodeBase64(encrypted);
            const nonceLength = sodium.crypto_secretbox_NONCEBYTES;
            const nonce = bundle.slice(0, nonceLength);
            const ciphertext = bundle.slice(nonceLength);
            const decrypted = sodium.crypto_secretbox_open_easy(ciphertext, nonce, this.secretKey);
            return decrypted ? new Uint8Array(decrypted) : null;
        } catch {
            return null;
        }
    }
}

export class BoxEncryption implements Encryptor, Decryptor {
    private readonly privateKey: Uint8Array;
    private readonly publicKey: Uint8Array;

    constructor(seed: Uint8Array) {
        // Use the seed to generate a proper keypair
        const keypair = sodium.crypto_box_seed_keypair(seed);
        this.privateKey = keypair.privateKey;
        this.publicKey = keypair.publicKey;
    }

    async encrypt(data: any[]): Promise<Uint8Array[]> {
        // Process as batch, not Promise.all - more efficient
        const results: Uint8Array[] = [];
        for (const item of data) {
            results.push(encryptBox(encodeUTF8(JSON.stringify(item)), this.publicKey));
        }
        return results;
    }

    async decrypt(data: Uint8Array[]): Promise<(any | null)[]> {
        // Process as batch, not Promise.all - more efficient
        const results: (any | null)[] = [];
        for (const item of data) {
            let decrypted = decryptBox(item, this.privateKey);
            if (!decrypted) {
                results.push(null);
                continue;
            }
            results.push(JSON.parse(decodeUTF8(decrypted)));
        }
        return results;
    }
}

export class AES256Encryption implements Encryptor, Decryptor, BinaryEncryptor {
    private readonly secretKey: Uint8Array;
    private readonly secretKeyB64: string;

    constructor(secretKey: Uint8Array) {
        this.secretKey = secretKey;
        this.secretKeyB64 = encodeBase64(secretKey);
    }

    async encrypt(data: any[]): Promise<Uint8Array[]> {
        // Process as batch, not Promise.all - more efficient
        const results: Uint8Array[] = [];
        for (const item of data) {
            // Serialize to JSON string first
            const encrypted = decodeBase64(await encryptAESGCMString(JSON.stringify(item), this.secretKeyB64));
            let output = new Uint8Array(encrypted.length + 1);
            output[0] = 0;
            output.set(encrypted, 1);
            results.push(output);
        }
        return results;
    }

    async decrypt(data: Uint8Array[]): Promise<(any | null)[]> {
        // Process as batch, not Promise.all - more efficient
        const results: (any | null)[] = [];
        for (const item of data) {
            try {
                if (item[0] !== 0) {
                    results.push(null);
                    continue;
                }
                const decryptedString = await decryptAESGCMString(encodeBase64(item.slice(1)), this.secretKeyB64);
                if (!decryptedString) {
                    results.push(null);
                } else {
                    // Parse JSON string back to object
                    results.push(JSON.parse(decryptedString));
                }
            } catch (error) {
                results.push(null);
            }
        }
        return results;
    }

    async encryptBinary(data: Uint8Array): Promise<string> {
        return encryptBinaryAESGCM(data, this.secretKeyB64);
    }

    async decryptBinary(encrypted: string): Promise<Uint8Array | null> {
        return decryptBinaryAESGCM(encrypted, this.secretKeyB64);
    }
}