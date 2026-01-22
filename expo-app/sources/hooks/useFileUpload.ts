/**
 * useFileUpload
 *
 * Hook for uploading files to a session's working directory via RPC.
 * Handles file picking, upload progress, and error states.
 */

import * as React from 'react';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';
import { apiSocket } from '@/sync/apiSocket';

export interface UploadedFile {
    id: string;
    fileName: string;
    size: number;
    status: 'pending' | 'uploading' | 'success' | 'error';
    error?: string;
    remotePath?: string;
}

interface UploadFileResponse {
    success: boolean;
    path?: string;
    size?: number;
    error?: string;
}

export function useFileUpload(sessionId: string | null) {
    const [files, setFiles] = React.useState<UploadedFile[]>([]);
    const [isUploading, setIsUploading] = React.useState(false);

    // Pick files using document picker
    const pickFiles = React.useCallback(async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                multiple: true,
                copyToCacheDirectory: true, // Ensure we can read the file
            });

            if (result.canceled) {
                return;
            }

            // Add picked files to state
            const newFiles: UploadedFile[] = result.assets.map((asset) => ({
                id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                fileName: asset.name,
                size: asset.size || 0,
                status: 'pending' as const,
                uri: asset.uri,
            }));

            setFiles(prev => [...prev, ...newFiles]);

            // Store URIs for upload
            return newFiles.map(f => ({ ...f, uri: result.assets.find(a => a.name === f.fileName)?.uri }));
        } catch (error) {
            console.error('[FileUpload] Error picking files:', error);
            return null;
        }
    }, []);

    // Upload a single file
    const uploadFile = React.useCallback(async (file: UploadedFile & { uri?: string }, subPath?: string) => {
        if (!sessionId || !file.uri) {
            return;
        }

        // Update status to uploading
        setFiles(prev => prev.map(f =>
            f.id === file.id ? { ...f, status: 'uploading' as const } : f
        ));

        try {
            // Read file content as base64
            let base64Content: string;

            if (Platform.OS === 'web') {
                // Web: fetch and convert to base64
                const response = await fetch(file.uri);
                const blob = await response.blob();
                base64Content = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        const result = reader.result as string;
                        // Remove data URL prefix if present
                        const base64 = result.split(',')[1] || result;
                        resolve(base64);
                    };
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                });
            } else {
                // Native: use FileSystem
                base64Content = await FileSystem.readAsStringAsync(file.uri, {
                    encoding: 'base64',
                });
            }

            // Send via RPC
            const response = await apiSocket.sessionRPC<UploadFileResponse, any>(
                sessionId,
                'uploadFile',
                {
                    fileName: file.fileName,
                    content: base64Content,
                    subPath: subPath,
                }
            );

            if (response.success) {
                setFiles(prev => prev.map(f =>
                    f.id === file.id
                        ? { ...f, status: 'success' as const, remotePath: response.path }
                        : f
                ));
            } else {
                setFiles(prev => prev.map(f =>
                    f.id === file.id
                        ? { ...f, status: 'error' as const, error: response.error || 'Upload failed' }
                        : f
                ));
            }
        } catch (error) {
            console.error('[FileUpload] Error uploading file:', error);
            setFiles(prev => prev.map(f =>
                f.id === file.id
                    ? { ...f, status: 'error' as const, error: error instanceof Error ? error.message : 'Upload failed' }
                    : f
            ));
        }
    }, [sessionId]);

    // Upload all pending files
    const uploadAllPending = React.useCallback(async (fileList?: (UploadedFile & { uri?: string })[], subPath?: string) => {
        const filesToUpload = fileList || files.filter(f => f.status === 'pending');

        if (filesToUpload.length === 0) {
            return;
        }

        setIsUploading(true);

        try {
            // Upload files sequentially to avoid overwhelming the connection
            for (const file of filesToUpload) {
                await uploadFile(file as UploadedFile & { uri?: string }, subPath);
            }
        } finally {
            setIsUploading(false);
        }
    }, [files, uploadFile]);

    // Remove a file from the list
    const removeFile = React.useCallback((fileId: string) => {
        setFiles(prev => prev.filter(f => f.id !== fileId));
    }, []);

    // Clear all files
    const clearFiles = React.useCallback(() => {
        setFiles([]);
    }, []);

    // Clear completed/errored files
    const clearCompleted = React.useCallback(() => {
        setFiles(prev => prev.filter(f => f.status === 'pending' || f.status === 'uploading'));
    }, []);

    return {
        files,
        isUploading,
        pickFiles,
        uploadFile,
        uploadAllPending,
        removeFile,
        clearFiles,
        clearCompleted,
    };
}

// Format file size for display
export function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
