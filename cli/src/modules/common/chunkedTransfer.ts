/**
 * Chunked file transfer handlers for large file download/upload
 * Splits files into 256KB chunks, encrypts each chunk as binary (no JSON overhead),
 * and transfers them individually via separate RPC calls
 */

import { readFile, writeFile, stat, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { randomBytes } from 'crypto';
import { logger } from '@/ui/logger';
import { encryptBinary, encodeBase64, encrypt } from '@/api/encryption';
import { RpcHandlerManager } from '@/api/rpc/RpcHandlerManager';
import { validatePath } from './pathSecurity';

const CHUNK_SIZE = 256 * 1024; // 256KB per chunk
const TRANSFER_TIMEOUT = 5 * 60 * 1000; // 5 minute timeout for idle transfers

interface ActiveTransfer {
    filePath: string;
    buffer: Buffer;
    totalChunks: number;
    chunkSize: number;
    createdAt: number;
}

interface ActiveWriteTransfer {
    filePath: string;
    chunks: Map<number, Buffer>;
    totalChunks: number;
    expectedSize: number;
    chunkSize: number;
    createdAt: number;
}

// Active read transfers indexed by transferId
const activeReadTransfers = new Map<string, ActiveTransfer>();
// Active write transfers indexed by transferId
const activeWriteTransfers = new Map<string, ActiveWriteTransfer>();

function generateTransferId(): string {
    return randomBytes(16).toString('hex');
}

/**
 * Clean up stale transfers that have been idle for too long
 */
function cleanupStaleTransfers(): void {
    const now = Date.now();
    for (const [id, transfer] of activeReadTransfers) {
        if (now - transfer.createdAt > TRANSFER_TIMEOUT) {
            activeReadTransfers.delete(id);
            logger.debug(`[chunkedTransfer] Cleaned up stale read transfer: ${id}`);
        }
    }
    for (const [id, transfer] of activeWriteTransfers) {
        if (now - transfer.createdAt > TRANSFER_TIMEOUT) {
            activeWriteTransfers.delete(id);
            logger.debug(`[chunkedTransfer] Cleaned up stale write transfer: ${id}`);
        }
    }
}

/**
 * Register chunked file transfer RPC handlers
 * @param rpcManager - The RPC handler manager
 * @param workingDirectory - The base working directory for path validation
 */
export function registerChunkedHandlers(rpcManager: RpcHandlerManager, workingDirectory: string): void {
    const encryptionKey = rpcManager.getEncryptionKey();
    const encryptionVariant = rpcManager.getEncryptionVariant();

    // Initialize a file read transfer - returns metadata (JSON-encrypted, normal handler)
    rpcManager.registerHandler<
        { path: string },
        { success: boolean; transferId?: string; totalChunks?: number; fileSize?: number; chunkSize?: number; error?: string }
    >('chunkedReadInit', async (data) => {
        logger.debug('[chunkedTransfer] chunkedReadInit:', data.path);
        cleanupStaleTransfers();

        const validation = validatePath(data.path, workingDirectory);
        if (!validation.valid) {
            return { success: false, error: validation.error };
        }

        try {
            const fileStat = await stat(data.path);
            if (!fileStat.isFile()) {
                return { success: false, error: 'Path is not a file' };
            }

            const buffer = await readFile(data.path);
            const totalChunks = Math.ceil(buffer.length / CHUNK_SIZE);
            const transferId = generateTransferId();

            activeReadTransfers.set(transferId, {
                filePath: data.path,
                buffer,
                totalChunks,
                chunkSize: CHUNK_SIZE,
                createdAt: Date.now(),
            });

            logger.debug(`[chunkedTransfer] Read transfer initialized: ${transferId}, size=${buffer.length}, chunks=${totalChunks}`);

            return {
                success: true,
                transferId,
                totalChunks,
                fileSize: buffer.length,
                chunkSize: CHUNK_SIZE,
            };
        } catch (error) {
            logger.debug('[chunkedTransfer] Failed to init read transfer:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to read file',
            };
        }
    });

    // Read a single chunk - returns binary-encrypted data (raw handler)
    rpcManager.registerRawHandler<{ transferId: string; chunkIndex: number }>('chunkedReadChunk', async (data) => {
        const transfer = activeReadTransfers.get(data.transferId);
        if (!transfer) {
            // Return error as normal JSON-encrypted response
            return encodeBase64(encrypt(encryptionKey, encryptionVariant, {
                success: false,
                error: 'Transfer not found',
            }));
        }

        if (data.chunkIndex < 0 || data.chunkIndex >= transfer.totalChunks) {
            return encodeBase64(encrypt(encryptionKey, encryptionVariant, {
                success: false,
                error: `Invalid chunk index: ${data.chunkIndex}`,
            }));
        }

        // Extract the chunk
        const start = data.chunkIndex * transfer.chunkSize;
        const end = Math.min(start + transfer.chunkSize, transfer.buffer.length);
        const chunk = new Uint8Array(transfer.buffer.slice(start, end));

        // Update timestamp to prevent cleanup
        transfer.createdAt = Date.now();

        // Encrypt as binary (no JSON serialization) and return base64
        const encrypted = encryptBinary(encryptionKey, encryptionVariant, chunk);
        return encodeBase64(encrypted);
    });

    // Complete a read transfer - cleanup resources (normal handler)
    rpcManager.registerHandler<
        { transferId: string },
        { success: boolean; error?: string }
    >('chunkedReadComplete', async (data) => {
        const existed = activeReadTransfers.delete(data.transferId);
        logger.debug(`[chunkedTransfer] Read transfer completed: ${data.transferId}, existed=${existed}`);
        return { success: true };
    });

    // Initialize a file write transfer - returns metadata (normal handler)
    rpcManager.registerHandler<
        { path: string; fileSize: number; totalChunks: number; chunkSize: number },
        { success: boolean; transferId?: string; error?: string }
    >('chunkedWriteInit', async (data) => {
        logger.debug('[chunkedTransfer] chunkedWriteInit:', data.path, 'size:', data.fileSize);
        cleanupStaleTransfers();

        const validation = validatePath(data.path, workingDirectory);
        if (!validation.valid) {
            return { success: false, error: validation.error };
        }

        try {
            // Ensure parent directory exists
            await mkdir(dirname(data.path), { recursive: true });

            const transferId = generateTransferId();
            activeWriteTransfers.set(transferId, {
                filePath: data.path,
                chunks: new Map(),
                totalChunks: data.totalChunks,
                expectedSize: data.fileSize,
                chunkSize: data.chunkSize,
                createdAt: Date.now(),
            });

            logger.debug(`[chunkedTransfer] Write transfer initialized: ${transferId}`);
            return { success: true, transferId };
        } catch (error) {
            logger.debug('[chunkedTransfer] Failed to init write transfer:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to initialize write',
            };
        }
    });

    // Receive a write chunk - binary-encrypted data (raw handler)
    rpcManager.registerRawHandler<{ transferId: string; chunkIndex: number; data: string }>('chunkedWriteChunk', async (params) => {
        const transfer = activeWriteTransfers.get(params.transferId);
        if (!transfer) {
            return encodeBase64(encrypt(encryptionKey, encryptionVariant, {
                success: false,
                error: 'Transfer not found',
            }));
        }

        if (params.chunkIndex < 0 || params.chunkIndex >= transfer.totalChunks) {
            return encodeBase64(encrypt(encryptionKey, encryptionVariant, {
                success: false,
                error: `Invalid chunk index: ${params.chunkIndex}`,
            }));
        }

        // The chunk data comes as base64 string in params
        const chunkBuffer = Buffer.from(params.data, 'base64');
        transfer.chunks.set(params.chunkIndex, chunkBuffer);
        transfer.createdAt = Date.now();

        // Return success as normal JSON-encrypted response
        return encodeBase64(encrypt(encryptionKey, encryptionVariant, {
            success: true,
            received: params.chunkIndex,
        }));
    });

    // Complete a write transfer - assemble and write file (normal handler)
    rpcManager.registerHandler<
        { transferId: string },
        { success: boolean; error?: string; bytesWritten?: number }
    >('chunkedWriteComplete', async (data) => {
        const transfer = activeWriteTransfers.get(data.transferId);
        if (!transfer) {
            return { success: false, error: 'Transfer not found' };
        }

        try {
            // Verify all chunks received
            if (transfer.chunks.size !== transfer.totalChunks) {
                return {
                    success: false,
                    error: `Missing chunks: got ${transfer.chunks.size}, expected ${transfer.totalChunks}`,
                };
            }

            // Assemble chunks in order
            const buffers: Buffer[] = [];
            for (let i = 0; i < transfer.totalChunks; i++) {
                const chunk = transfer.chunks.get(i);
                if (!chunk) {
                    return { success: false, error: `Missing chunk ${i}` };
                }
                buffers.push(chunk);
            }

            const assembled = Buffer.concat(buffers);
            await writeFile(transfer.filePath, assembled);

            activeWriteTransfers.delete(data.transferId);
            logger.debug(`[chunkedTransfer] Write transfer completed: ${data.transferId}, bytes=${assembled.length}`);

            return { success: true, bytesWritten: assembled.length };
        } catch (error) {
            activeWriteTransfers.delete(data.transferId);
            logger.debug('[chunkedTransfer] Failed to complete write transfer:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to write file',
            };
        }
    });

    // Cancel any active transfer (normal handler)
    rpcManager.registerHandler<
        { transferId: string },
        { success: boolean }
    >('chunkedTransferCancel', async (data) => {
        activeReadTransfers.delete(data.transferId);
        activeWriteTransfers.delete(data.transferId);
        logger.debug(`[chunkedTransfer] Transfer cancelled: ${data.transferId}`);
        return { success: true };
    });
}
