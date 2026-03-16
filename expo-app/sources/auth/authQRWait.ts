import axios from 'axios';
import { decodeBase64, encodeBase64 } from '../encryption/base64';
import { getServerUrl } from '@/sync/serverConfig';
import { QRAuthKeyPair } from './authQRStart';
import { decryptBox } from '@/encryption/libsodium';

export interface AuthCredentials {
    secret: Uint8Array;
    token: string;
}

export async function authQRWait(keypair: QRAuthKeyPair, onProgress?: (dots: number) => void, shouldCancel?: () => boolean): Promise<AuthCredentials | null> {
    let dots = 0;
    let consecutiveErrors = 0;
    const MAX_CONSECUTIVE_ERRORS = 5;
    const serverUrl = getServerUrl();

    while (true) {
        if (shouldCancel && shouldCancel()) {
            return null;
        }

        try {
            const response = await axios.post(`${serverUrl}/v1/auth/account/request`, {
                publicKey: encodeBase64(keypair.publicKey),
            });

            consecutiveErrors = 0;

            if (response.data.state === 'authorized') {
                const token = response.data.token as string;
                const responseStr = response.data.response as string;

                const encryptedResponse = decodeBase64(responseStr);

                const decrypted = decryptBox(encryptedResponse, keypair.secretKey);
                if (decrypted) {
                    return {
                        secret: decrypted,
                        token: token
                    };
                } else {
                    throw new Error(`Decrypt failed. bundle=${encryptedResponse.length}bytes, sk=${keypair.secretKey.length}bytes`);
                }
            }
        } catch (error: any) {
            // Decrypt failures are thrown as errors, propagate them
            if (error?.message?.startsWith('Decrypt failed')) {
                throw error;
            }
            consecutiveErrors++;
            if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
                throw new Error(`Poll failed ${MAX_CONSECUTIVE_ERRORS} times: ${error?.message || String(error)}`);
            }
        }

        // Call progress callback if provided
        if (onProgress) {
            onProgress(dots);
        }
        dots++;

        // Wait 1 second before next check
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
}