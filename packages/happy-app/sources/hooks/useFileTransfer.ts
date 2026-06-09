/**
 * useFileTransfer
 *
 * Send files from the client into a session's working directory (upload) and
 * pull files back out onto the device (download). Works on web and native:
 *  - upload reads the picked file's bytes via the platform-resolved
 *    readFileBytes() helper, then ships base64 over the `uploadFile` RPC.
 *  - download fetches base64 via the `readFile` RPC, then saves: a browser
 *    download on web, or a temp file + share sheet on native.
 */
import * as React from 'react';
import { Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { writeAsStringAsync, cacheDirectory, EncodingType } from 'expo-file-system/legacy';
import { Modal } from '@/modal';
import { t } from '@/text';
import { sessionReadFile, sessionUploadFile } from '@/sync/ops';
import { readFileBytes } from '@/utils/readFileBytes';
import { decodeBase64, encodeBase64 } from '@/encryption/base64';

// Save raw bytes onto the device. Web triggers a browser download; native
// stages a temp file and opens the system share sheet.
async function saveBytesToDevice(fileName: string, bytes: Uint8Array): Promise<void> {
    if (Platform.OS === 'web') {
        const blob = new Blob([bytes as unknown as BlobPart]);
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = fileName;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
        return;
    }

    if (!cacheDirectory) {
        throw new Error('cacheDirectory unavailable on this platform');
    }
    const safeName = fileName.replace(/[/\\]/g, '_');
    const tempUri = `${cacheDirectory}${safeName}`;
    await writeAsStringAsync(tempUri, encodeBase64(bytes), { encoding: EncodingType.Base64 });
    if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(tempUri);
    }
}

export function useFileTransfer(sessionId: string | null) {
    const [isUploading, setIsUploading] = React.useState(false);
    const [isDownloading, setIsDownloading] = React.useState(false);

    // Pick one or more files and upload them into the working directory.
    const pickAndUpload = React.useCallback(async (subPath?: string) => {
        if (!sessionId) return;
        const result = await DocumentPicker.getDocumentAsync({
            multiple: true,
            copyToCacheDirectory: true,
        });
        if (result.canceled || result.assets.length === 0) return;

        setIsUploading(true);
        const failures: string[] = [];
        const saved: string[] = [];
        try {
            for (const asset of result.assets) {
                try {
                    const bytes = await readFileBytes(asset.uri);
                    const response = await sessionUploadFile(
                        sessionId,
                        asset.name,
                        encodeBase64(bytes),
                        subPath,
                    );
                    if (response.success) {
                        saved.push(response.path ?? asset.name);
                    } else {
                        failures.push(`${asset.name}: ${response.error ?? 'failed'}`);
                    }
                } catch (e) {
                    failures.push(`${asset.name}: ${e instanceof Error ? e.message : 'failed'}`);
                }
            }
        } finally {
            setIsUploading(false);
        }

        if (failures.length === 0) {
            Modal.alert(t('common.success'), saved.join('\n'));
        } else {
            Modal.alert(t('common.error'), [...saved, ...failures].join('\n'));
        }
    }, [sessionId]);

    // Download a file from the working directory onto the device.
    const downloadFile = React.useCallback(async (path: string, fileName: string) => {
        if (!sessionId) return;
        setIsDownloading(true);
        try {
            const response = await sessionReadFile(sessionId, path);
            if (!response.success || !response.content) {
                Modal.alert(t('common.error'), response.error ?? path);
                return;
            }
            await saveBytesToDevice(fileName, decodeBase64(response.content));
        } catch (e) {
            Modal.alert(t('common.error'), e instanceof Error ? e.message : path);
        } finally {
            setIsDownloading(false);
        }
    }, [sessionId]);

    return { isUploading, isDownloading, pickAndUpload, downloadFile };
}
