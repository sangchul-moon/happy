/**
 * Chunked file transfer client for large file download/upload
 * Downloads files in 256KB chunks via separate RPC calls with progress reporting
 */

import { apiSocket } from './apiSocket';

interface ChunkedReadInitResponse {
    success: boolean;
    transferId?: string;
    totalChunks?: number;
    fileSize?: number;
    chunkSize?: number;
    error?: string;
}

interface ChunkedWriteInitResponse {
    success: boolean;
    transferId?: string;
    error?: string;
}

export interface ChunkedDownloadOptions {
    sessionId: string;
    remotePath: string;
    onProgress?: (percent: number) => void;
    signal?: AbortSignal;
}

export interface ChunkedUploadOptions {
    sessionId: string;
    remotePath: string;
    data: Uint8Array;
    onProgress?: (percent: number) => void;
    signal?: AbortSignal;
}

const UPLOAD_CHUNK_SIZE = 256 * 1024; // 256KB

/**
 * Download a file using chunked transfer protocol
 * Each chunk is individually encrypted as binary (no JSON overhead)
 */
export async function chunkedDownload(options: ChunkedDownloadOptions): Promise<Uint8Array> {
    const { sessionId, remotePath, onProgress, signal } = options;

    // Step 1: Initialize transfer
    const initResult = await apiSocket.sessionRPC<ChunkedReadInitResponse, { path: string }>(
        sessionId,
        'chunkedReadInit',
        { path: remotePath }
    );

    if (!initResult.success || !initResult.transferId) {
        throw new Error(initResult.error || 'Failed to initialize chunked download');
    }

    const { transferId, totalChunks, fileSize } = initResult;

    try {
        // Step 2: Download chunks sequentially
        const chunks: Uint8Array[] = [];
        let receivedBytes = 0;

        for (let i = 0; i < totalChunks!; i++) {
            // Check for cancellation
            if (signal?.aborted) {
                // Cleanup transfer on cancellation
                await apiSocket.sessionRPC(sessionId, 'chunkedTransferCancel', { transferId }).catch(() => {});
                throw new DOMException('Download cancelled', 'AbortError');
            }

            // Download chunk as binary (no JSON overhead)
            const chunk = await apiSocket.sessionRPCBinary(sessionId, 'chunkedReadChunk', {
                transferId,
                chunkIndex: i,
            });

            chunks.push(chunk);
            receivedBytes += chunk.length;

            // Report progress
            if (onProgress && fileSize) {
                onProgress(Math.round((receivedBytes / fileSize) * 100));
            }
        }

        // Step 3: Complete transfer (cleanup server resources)
        await apiSocket.sessionRPC(sessionId, 'chunkedReadComplete', { transferId }).catch(() => {});

        // Step 4: Assemble chunks
        const result = new Uint8Array(receivedBytes);
        let offset = 0;
        for (const chunk of chunks) {
            result.set(chunk, offset);
            offset += chunk.length;
        }

        return result;
    } catch (error) {
        // Cleanup on any error
        await apiSocket.sessionRPC(sessionId, 'chunkedTransferCancel', { transferId }).catch(() => {});
        throw error;
    }
}

/**
 * Upload a file using chunked transfer protocol
 */
export async function chunkedUpload(options: ChunkedUploadOptions): Promise<void> {
    const { sessionId, remotePath, data, onProgress, signal } = options;

    const totalChunks = Math.ceil(data.length / UPLOAD_CHUNK_SIZE);

    // Step 1: Initialize write transfer
    const initResult = await apiSocket.sessionRPC<ChunkedWriteInitResponse, {
        path: string;
        fileSize: number;
        totalChunks: number;
        chunkSize: number;
    }>(
        sessionId,
        'chunkedWriteInit',
        {
            path: remotePath,
            fileSize: data.length,
            totalChunks,
            chunkSize: UPLOAD_CHUNK_SIZE,
        }
    );

    if (!initResult.success || !initResult.transferId) {
        throw new Error(initResult.error || 'Failed to initialize chunked upload');
    }

    const { transferId } = initResult;

    try {
        // Step 2: Upload chunks sequentially
        for (let i = 0; i < totalChunks; i++) {
            if (signal?.aborted) {
                await apiSocket.sessionRPC(sessionId, 'chunkedTransferCancel', { transferId }).catch(() => {});
                throw new DOMException('Upload cancelled', 'AbortError');
            }

            const start = i * UPLOAD_CHUNK_SIZE;
            const end = Math.min(start + UPLOAD_CHUNK_SIZE, data.length);
            const chunk = data.slice(start, end);

            // Convert chunk to base64 for transport within JSON params
            // Note: Cannot use String.fromCharCode(...chunk) as spread on large arrays exceeds call stack
            let binary = '';
            for (let j = 0; j < chunk.length; j++) {
                binary += String.fromCharCode(chunk[j]);
            }
            const chunkBase64 = btoa(binary);

            await apiSocket.sessionRPC(sessionId, 'chunkedWriteChunk', {
                transferId,
                chunkIndex: i,
                data: chunkBase64,
            });

            if (onProgress) {
                onProgress(Math.round(((i + 1) / totalChunks) * 100));
            }
        }

        // Step 3: Complete write transfer (assemble and write on CLI side)
        const completeResult = await apiSocket.sessionRPC<{
            success: boolean;
            error?: string;
            bytesWritten?: number;
        }, { transferId: string }>(
            sessionId,
            'chunkedWriteComplete',
            { transferId }
        );

        if (!completeResult.success) {
            throw new Error(completeResult.error || 'Failed to complete chunked upload');
        }
    } catch (error) {
        await apiSocket.sessionRPC(sessionId, 'chunkedTransferCancel', { transferId }).catch(() => {});
        throw error;
    }
}
