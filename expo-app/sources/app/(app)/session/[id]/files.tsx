import * as React from 'react';
import { View, ActivityIndicator, Platform, TextInput, Pressable, ScrollView } from 'react-native';
import { t } from '@/text';
import { useRoute } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Octicons, Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/StyledText';
import { Item } from '@/components/Item';
import { ItemList } from '@/components/ItemList';
import { Typography } from '@/constants/Typography';
import { storage } from '@/sync/storage';
import { useUnistyles, StyleSheet } from 'react-native-unistyles';
import { layout } from '@/components/layout';
import { FileIcon } from '@/components/FileIcon';
import {
    sessionListDirectory,
    sessionWriteFile,
    sessionCreateDirectory,
    sessionRename,
    sessionDeleteFile,
    sessionReadFile,
    sessionDownloadFile,
    DirectoryEntry
} from '@/sync/ops';
import { Modal } from '@/modal';
import { useFileUpload, UploadedFile } from '@/hooks/useFileUpload';

// Input dialog component for file operations
const InputDialog: React.FC<{
    visible: boolean;
    title: string;
    placeholder: string;
    initialValue?: string;
    onSubmit: (value: string) => void;
    onCancel: () => void;
}> = ({ visible, title, placeholder, initialValue = '', onSubmit, onCancel }) => {
    const [value, setValue] = React.useState(initialValue);
    const { theme } = useUnistyles();

    React.useEffect(() => {
        if (visible) {
            setValue(initialValue);
        }
    }, [visible, initialValue]);

    if (!visible) return null;

    return (
        <View style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
        }}>
            <View style={{
                backgroundColor: theme.colors.surface,
                borderRadius: 12,
                padding: 20,
                width: '85%',
                maxWidth: 400,
            }}>
                <Text style={{
                    fontSize: 18,
                    fontWeight: '600',
                    color: theme.colors.text,
                    marginBottom: 16,
                    ...Typography.default('semiBold')
                }}>
                    {title}
                </Text>
                <TextInput
                    value={value}
                    onChangeText={setValue}
                    placeholder={placeholder}
                    placeholderTextColor={theme.colors.input.placeholder}
                    autoFocus
                    style={{
                        backgroundColor: theme.colors.input.background,
                        borderRadius: 8,
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                        fontSize: 16,
                        color: theme.colors.text,
                        marginBottom: 16,
                        ...Typography.default()
                    }}
                />
                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12 }}>
                    <Pressable
                        onPress={onCancel}
                        style={{
                            paddingHorizontal: 16,
                            paddingVertical: 10,
                            borderRadius: 8,
                            backgroundColor: theme.colors.input.background,
                        }}
                    >
                        <Text style={{ color: theme.colors.textSecondary, ...Typography.default() }}>
                            {t('files.cancel')}
                        </Text>
                    </Pressable>
                    <Pressable
                        onPress={() => value.trim() && onSubmit(value.trim())}
                        style={{
                            paddingHorizontal: 16,
                            paddingVertical: 10,
                            borderRadius: 8,
                            backgroundColor: theme.colors.textLink,
                        }}
                    >
                        <Text style={{ color: 'white', fontWeight: '600', ...Typography.default() }}>
                            {t('files.confirm')}
                        </Text>
                    </Pressable>
                </View>
            </View>
        </View>
    );
};

// File entry with full path info
interface FileEntry extends DirectoryEntry {
    fullPath: string;
}

// Reusable file explorer content component
export function FileExplorerContent({ sessionId, onNavigate }: { sessionId: string; onNavigate?: () => void }) {
    const router = useRouter();
    const { theme } = useUnistyles();

    // State
    const [currentPath, setCurrentPath] = React.useState<string>('');
    const [entries, setEntries] = React.useState<FileEntry[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);

    // File management states
    const [showActionsMenu, setShowActionsMenu] = React.useState(false);
    const [selectedFile, setSelectedFile] = React.useState<FileEntry | null>(null);
    const [dialogType, setDialogType] = React.useState<'newFile' | 'newFolder' | 'rename' | null>(null);
    const [isOperating, setIsOperating] = React.useState(false);

    // File upload hook
    const fileUpload = useFileUpload(sessionId);

    // Get session path (root directory)
    const session = storage.getState().sessions[sessionId];
    const rootPath = session?.metadata?.path || '';

    // Initialize current path to root
    React.useEffect(() => {
        if (rootPath && !currentPath) {
            setCurrentPath(rootPath);
        }
    }, [rootPath, currentPath]);

    // Load directory contents
    const loadDirectory = React.useCallback(async (path: string) => {
        if (!sessionId || !path) return;

        setIsLoading(true);
        setError(null);

        try {
            const result = await sessionListDirectory(sessionId, path);

            if (result.success && result.entries) {
                // Sort: directories first, then files, alphabetically
                const sorted = [...result.entries].sort((a, b) => {
                    if (a.type === 'directory' && b.type !== 'directory') return -1;
                    if (a.type !== 'directory' && b.type === 'directory') return 1;
                    return a.name.localeCompare(b.name);
                });

                // Add full path to each entry
                const entriesWithPath: FileEntry[] = sorted.map(entry => ({
                    ...entry,
                    fullPath: `${path}/${entry.name}`
                }));

                setEntries(entriesWithPath);
            } else {
                setError(result.error || 'Failed to load directory');
                setEntries([]);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load directory');
            setEntries([]);
        } finally {
            setIsLoading(false);
        }
    }, [sessionId]);

    // Load on mount and when path changes
    React.useEffect(() => {
        if (currentPath) {
            loadDirectory(currentPath);
        }
    }, [currentPath, loadDirectory]);

    // Refresh when screen is focused
    useFocusEffect(
        React.useCallback(() => {
            if (currentPath) {
                loadDirectory(currentPath);
            }
        }, [currentPath, loadDirectory])
    );

    // Navigation handlers
    const handleEntryPress = React.useCallback((entry: FileEntry) => {
        if (entry.type === 'directory') {
            setCurrentPath(entry.fullPath);
        } else {
            // Close sheet before navigating to file viewer
            onNavigate?.();
            const encodedPath = btoa(entry.fullPath);
            router.push(`/session/${sessionId}/file?path=${encodedPath}`);
        }
    }, [router, sessionId, onNavigate]);

    const handleGoBack = React.useCallback(() => {
        if (currentPath === rootPath) return;

        const parentPath = currentPath.substring(0, currentPath.lastIndexOf('/'));
        if (parentPath && parentPath.startsWith(rootPath.substring(0, rootPath.lastIndexOf('/')))) {
            setCurrentPath(parentPath || rootPath);
        }
    }, [currentPath, rootPath]);

    const canGoBack = currentPath !== rootPath;

    // Long press to show actions menu
    const handleEntryLongPress = React.useCallback((entry: FileEntry) => {
        setSelectedFile(entry);
        setShowActionsMenu(true);
    }, []);

    // File management handlers
    const handleCreateFile = React.useCallback(async (fileName: string) => {
        if (!currentPath || !sessionId) return;

        setIsOperating(true);
        try {
            const filePath = `${currentPath}/${fileName}`;
            const result = await sessionWriteFile(sessionId, filePath, btoa(''), null);

            if (result.success) {
                Modal.alert(t('files.createFileSuccess'), '');
                loadDirectory(currentPath);
            } else {
                Modal.alert(t('files.operationFailed'), result.error || '');
            }
        } catch (err) {
            Modal.alert(t('files.operationFailed'), err instanceof Error ? err.message : '');
        } finally {
            setIsOperating(false);
            setDialogType(null);
        }
    }, [sessionId, currentPath, loadDirectory]);

    const handleCreateFolder = React.useCallback(async (folderName: string) => {
        if (!currentPath || !sessionId) return;

        setIsOperating(true);
        try {
            const folderPath = `${currentPath}/${folderName}`;
            const result = await sessionCreateDirectory(sessionId, folderPath);

            if (result.success) {
                Modal.alert(t('files.createFolderSuccess'), '');
                loadDirectory(currentPath);
            } else {
                Modal.alert(t('files.operationFailed'), result.error || '');
            }
        } catch (err) {
            Modal.alert(t('files.operationFailed'), err instanceof Error ? err.message : '');
        } finally {
            setIsOperating(false);
            setDialogType(null);
        }
    }, [sessionId, currentPath, loadDirectory]);

    const handleRename = React.useCallback(async (newName: string) => {
        if (!selectedFile || !sessionId) return;

        setIsOperating(true);
        try {
            const oldPath = selectedFile.fullPath;
            const parentPath = oldPath.substring(0, oldPath.lastIndexOf('/'));
            const newPath = `${parentPath}/${newName}`;

            const result = await sessionRename(sessionId, oldPath, newPath);

            if (result.success) {
                Modal.alert(t('files.renameSuccess'), '');
                loadDirectory(currentPath);
            } else {
                Modal.alert(t('files.operationFailed'), result.error || '');
            }
        } catch (err) {
            Modal.alert(t('files.operationFailed'), err instanceof Error ? err.message : '');
        } finally {
            setIsOperating(false);
            setDialogType(null);
            setSelectedFile(null);
        }
    }, [sessionId, selectedFile, currentPath, loadDirectory]);

    const handleDelete = React.useCallback(async () => {
        console.log('[handleDelete] Called, selectedFile:', selectedFile?.name, 'sessionId:', sessionId);
        if (!selectedFile || !sessionId) return;

        setShowActionsMenu(false);
        console.log('[handleDelete] Showing confirm dialog');

        const confirmed = await Modal.confirm(
            t('files.deleteConfirmTitle'),
            t('files.deleteConfirmMessage', { name: selectedFile.name }),
            {
                confirmText: t('files.delete'),
                cancelText: t('files.cancel'),
                destructive: true
            }
        );

        console.log('[handleDelete] Confirm result:', confirmed);
        if (!confirmed) {
            setSelectedFile(null);
            return;
        }

        setIsOperating(true);
        try {
            console.log('[FileDelete] Deleting:', sessionId, selectedFile.fullPath);
            const result = await sessionDeleteFile(sessionId, selectedFile.fullPath);
            console.log('[FileDelete] Result:', result);

            if (result.success) {
                Modal.alert(t('files.deleteSuccess'), '');
                loadDirectory(currentPath);
            } else {
                Modal.alert(t('files.operationFailed'), result.error || '');
            }
        } catch (err) {
            Modal.alert(t('files.operationFailed'), err instanceof Error ? err.message : '');
        } finally {
            setIsOperating(false);
            setSelectedFile(null);
        }
    }, [sessionId, selectedFile, currentPath, loadDirectory]);

    // Handle file upload to current directory
    const handleUploadFile = React.useCallback(async () => {
        const newFiles = await fileUpload.pickFiles();
        if (newFiles && newFiles.length > 0) {
            // Calculate subPath relative to root
            const subPath = currentPath !== rootPath
                ? currentPath.substring(rootPath.length + 1) // Remove root path and leading slash
                : undefined;

            // Upload files to current directory
            await fileUpload.uploadAllPending(newFiles, subPath);

            // Refresh directory after upload
            loadDirectory(currentPath);
        }
    }, [fileUpload, currentPath, rootPath, loadDirectory]);

    // Track download state: which file, progress percentage, and abort controller
    const [downloadProgress, setDownloadProgress] = React.useState<{
        file: string;
        percent: number;
    } | null>(null);
    const downloadAbortRef = React.useRef<AbortController | null>(null);

    // Cancel active download
    const handleCancelDownload = React.useCallback(() => {
        if (downloadAbortRef.current) {
            downloadAbortRef.current.abort();
            downloadAbortRef.current = null;
        }
        setDownloadProgress(null);
    }, []);

    // Handle file download using chunked transfer for large files
    const handleDownloadFile = React.useCallback(async (file: FileEntry) => {
        if (!sessionId || file.type === 'directory') return;

        const abortController = new AbortController();
        downloadAbortRef.current = abortController;

        setDownloadProgress({ file: file.fullPath, percent: 0 });
        try {
            const bytes = await sessionDownloadFile(
                sessionId,
                file.fullPath,
                file.size,
                (percent) => setDownloadProgress({ file: file.fullPath, percent }),
                abortController.signal,
            );

            const blob = new Blob([bytes.buffer as ArrayBuffer]);

            // Create download link
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = file.name;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            Modal.alert(t('files.downloadSuccess'), '');
        } catch (err) {
            if (err instanceof DOMException && err.name === 'AbortError') {
                // Download was cancelled by user - no error message needed
            } else {
                Modal.alert(t('files.operationFailed'), err instanceof Error ? err.message : '');
            }
        } finally {
            downloadAbortRef.current = null;
            setDownloadProgress(null);
        }
    }, [sessionId]);

    // Handle file download from actions menu (uses selectedFile)
    const handleDownload = React.useCallback(async () => {
        if (!selectedFile) return;
        setShowActionsMenu(false);
        setSelectedFile(null);
        await handleDownloadFile(selectedFile);
    }, [selectedFile, handleDownloadFile]);

    // Render icon for entry
    const renderEntryIcon = (entry: FileEntry) => {
        if (entry.type === 'directory') {
            return <Octicons name="file-directory" size={29} color="#007AFF" />;
        }
        return <FileIcon fileName={entry.name} size={29} />;
    };

    // Format file size
    const formatSize = (bytes?: number) => {
        if (bytes === undefined) return '';
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    // Format modification date
    const formatDate = (timestamp?: number) => {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        const now = new Date();
        const isThisYear = date.getFullYear() === now.getFullYear();
        const month = date.toLocaleString('default', { month: 'short' });
        const day = date.getDate();
        if (isThisYear) {
            const hours = date.getHours().toString().padStart(2, '0');
            const minutes = date.getMinutes().toString().padStart(2, '0');
            return `${month} ${day}, ${hours}:${minutes}`;
        }
        return `${month} ${day}, ${date.getFullYear()}`;
    };

    // Format subtitle with size and date
    const formatSubtitle = (entry: FileEntry) => {
        if (entry.type === 'directory') {
            const date = formatDate(entry.modified);
            return date ? `${t('files.folder')}  ·  ${date}` : t('files.folder');
        }
        const parts: string[] = [];
        const size = formatSize(entry.size);
        if (size) parts.push(size);
        const date = formatDate(entry.modified);
        if (date) parts.push(date);
        return parts.join('  ·  ') || t('files.file');
    };

    // Get relative path from root
    const getRelativePath = () => {
        if (!currentPath || !rootPath) return '/';
        if (currentPath === rootPath) return '/';
        return currentPath.substring(rootPath.length) || '/';
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>

            {/* Input dialogs */}
            <InputDialog
                visible={dialogType === 'newFile'}
                title={t('files.newFile')}
                placeholder={t('files.enterFileName')}
                onSubmit={handleCreateFile}
                onCancel={() => setDialogType(null)}
            />
            <InputDialog
                visible={dialogType === 'newFolder'}
                title={t('files.newFolder')}
                placeholder={t('files.enterFolderName')}
                onSubmit={handleCreateFolder}
                onCancel={() => setDialogType(null)}
            />
            <InputDialog
                visible={dialogType === 'rename'}
                title={t('files.rename')}
                placeholder={t('files.enterNewName')}
                initialValue={selectedFile?.name || ''}
                onSubmit={handleRename}
                onCancel={() => {
                    setDialogType(null);
                    setSelectedFile(null);
                }}
            />

            {/* Actions menu overlay */}
            {showActionsMenu && selectedFile && (
                <View style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    justifyContent: 'flex-end',
                    zIndex: 1000,
                }}>
                    <Pressable
                        style={{ flex: 1 }}
                        onPress={() => {
                            setShowActionsMenu(false);
                            setSelectedFile(null);
                        }}
                    />
                    <View style={{
                        backgroundColor: theme.colors.surface,
                        borderTopLeftRadius: 16,
                        borderTopRightRadius: 16,
                        paddingBottom: Platform.OS === 'ios' ? 34 : 16,
                    }}>
                        <View style={{
                            padding: 16,
                            borderBottomWidth: Platform.select({ ios: 0.33, default: 1 }),
                            borderBottomColor: theme.colors.divider,
                        }}>
                            <Text style={{
                                fontSize: 16,
                                fontWeight: '600',
                                color: theme.colors.text,
                                ...Typography.default('semiBold')
                            }}>
                                {selectedFile.name}
                            </Text>
                            <Text style={{
                                fontSize: 12,
                                color: theme.colors.textSecondary,
                                marginTop: 4,
                                ...Typography.default()
                            }}>
                                {selectedFile.type === 'directory' ? t('files.folder') : formatSize(selectedFile.size)}
                            </Text>
                        </View>
                        {/* Download button - only for files */}
                        {selectedFile.type !== 'directory' && (
                            <Pressable
                                onPress={handleDownload}
                                disabled={isOperating || downloadProgress !== null}
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    padding: 16,
                                    gap: 12,
                                    opacity: (isOperating || downloadProgress !== null) ? 0.5 : 1,
                                }}
                            >
                                <Octicons name="download" size={20} color={theme.colors.text} />
                                <Text style={{ fontSize: 16, color: theme.colors.text, ...Typography.default() }}>
                                    {t('files.download')}
                                </Text>
                            </Pressable>
                        )}
                        <Pressable
                            onPress={() => {
                                setShowActionsMenu(false);
                                setDialogType('rename');
                            }}
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                padding: 16,
                                gap: 12,
                            }}
                        >
                            <Octicons name="pencil" size={20} color={theme.colors.text} />
                            <Text style={{ fontSize: 16, color: theme.colors.text, ...Typography.default() }}>
                                {t('files.rename')}
                            </Text>
                        </Pressable>
                        <Pressable
                            onPress={() => {
                                console.log('[Delete Button] Pressed');
                                handleDelete();
                            }}
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                padding: 16,
                                gap: 12,
                            }}
                        >
                            <Octicons name="trash" size={20} color={theme.colors.textDestructive} />
                            <Text style={{ fontSize: 16, color: theme.colors.textDestructive, ...Typography.default() }}>
                                {t('files.delete')}
                            </Text>
                        </Pressable>
                    </View>
                </View>
            )}

            {/* Header with path and actions */}
            <View style={{
                padding: 16,
                borderBottomWidth: Platform.select({ ios: 0.33, default: 1 }),
                borderBottomColor: theme.colors.divider
            }}>
                {/* Path breadcrumb */}
                <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    marginBottom: 12,
                }}>
                    {canGoBack && (
                        <Pressable
                            onPress={handleGoBack}
                            style={{
                                marginRight: 8,
                                padding: 4,
                            }}
                        >
                            <Octicons name="arrow-left" size={20} color={theme.colors.textLink} />
                        </Pressable>
                    )}
                    <Octicons name="file-directory" size={16} color={theme.colors.textSecondary} style={{ marginRight: 6 }} />
                    <Text style={{
                        fontSize: 14,
                        color: theme.colors.text,
                        flex: 1,
                        ...Typography.default()
                    }} numberOfLines={1}>
                        {getRelativePath()}
                    </Text>
                </View>

                {/* Action buttons */}
                <View style={{
                    flexDirection: 'row',
                    gap: 8,
                    flexWrap: 'wrap',
                }}>
                    <Pressable
                        onPress={() => loadDirectory(currentPath)}
                        style={{
                            backgroundColor: theme.colors.input.background,
                            borderRadius: 10,
                            padding: 10,
                        }}
                    >
                        <Octicons name="sync" size={18} color={theme.colors.textSecondary} />
                    </Pressable>
                    <Pressable
                        onPress={handleUploadFile}
                        disabled={fileUpload.isUploading}
                        style={{
                            backgroundColor: theme.colors.input.background,
                            borderRadius: 10,
                            padding: 10,
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 6,
                            opacity: fileUpload.isUploading ? 0.5 : 1,
                        }}
                    >
                        {fileUpload.isUploading ? (
                            <ActivityIndicator size="small" color={theme.colors.textLink} />
                        ) : (
                            <Ionicons name="cloud-upload-outline" size={18} color={theme.colors.textLink} />
                        )}
                        <Text style={{ fontSize: 14, color: theme.colors.textLink, ...Typography.default() }}>
                            {t('files.upload')}
                        </Text>
                    </Pressable>
                    <Pressable
                        onPress={() => setDialogType('newFile')}
                        style={{
                            backgroundColor: theme.colors.input.background,
                            borderRadius: 10,
                            padding: 10,
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 6,
                        }}
                    >
                        <Octicons name="file" size={18} color={theme.colors.textLink} />
                        <Text style={{ fontSize: 14, color: theme.colors.textLink, ...Typography.default() }}>
                            {t('files.newFile')}
                        </Text>
                    </Pressable>
                    <Pressable
                        onPress={() => setDialogType('newFolder')}
                        style={{
                            backgroundColor: theme.colors.input.background,
                            borderRadius: 10,
                            padding: 10,
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 6,
                        }}
                    >
                        <Octicons name="file-directory" size={18} color={theme.colors.textLink} />
                        <Text style={{ fontSize: 14, color: theme.colors.textLink, ...Typography.default() }}>
                            {t('files.newFolder')}
                        </Text>
                    </Pressable>
                </View>
            </View>

            {/* File list */}
            <ItemList style={{ flex: 1 }}>
                {isLoading ? (
                    <View style={{
                        flex: 1,
                        justifyContent: 'center',
                        alignItems: 'center',
                        paddingTop: 40
                    }}>
                        <ActivityIndicator size="small" color={theme.colors.textSecondary} />
                    </View>
                ) : error ? (
                    <View style={{
                        flex: 1,
                        justifyContent: 'center',
                        alignItems: 'center',
                        paddingTop: 40,
                        paddingHorizontal: 20
                    }}>
                        <Octicons name="alert" size={48} color={theme.colors.textDestructive} />
                        <Text style={{
                            fontSize: 16,
                            color: theme.colors.textDestructive,
                            textAlign: 'center',
                            marginTop: 16,
                            ...Typography.default()
                        }}>
                            {error}
                        </Text>
                        <Pressable
                            onPress={() => loadDirectory(currentPath)}
                            style={{
                                marginTop: 16,
                                paddingHorizontal: 16,
                                paddingVertical: 10,
                                backgroundColor: theme.colors.textLink,
                                borderRadius: 8,
                            }}
                        >
                            <Text style={{ color: 'white', ...Typography.default() }}>
                                {t('files.retry')}
                            </Text>
                        </Pressable>
                    </View>
                ) : entries.length === 0 ? (
                    <View style={{
                        flex: 1,
                        justifyContent: 'center',
                        alignItems: 'center',
                        paddingTop: 40,
                        paddingHorizontal: 20
                    }}>
                        <Octicons name="file-directory" size={48} color={theme.colors.textSecondary} />
                        <Text style={{
                            fontSize: 16,
                            color: theme.colors.textSecondary,
                            textAlign: 'center',
                            marginTop: 16,
                            ...Typography.default()
                        }}>
                            {t('files.emptyFolder')}
                        </Text>
                    </View>
                ) : (
                    <>
                        {entries.map((entry, index) => (
                            <Item
                                key={`${entry.fullPath}-${index}`}
                                title={entry.name}
                                subtitle={formatSubtitle(entry)}
                                icon={renderEntryIcon(entry)}
                                onPress={() => handleEntryPress(entry)}
                                onLongPress={() => handleEntryLongPress(entry)}
                                showDivider={index < entries.length - 1}
                                rightElement={
                                    entry.type === 'directory' ? (
                                        <Octicons name="chevron-right" size={16} color={theme.colors.textSecondary} />
                                    ) : downloadProgress?.file === entry.fullPath ? (
                                        <Pressable
                                            onPress={(e) => {
                                                e.stopPropagation();
                                                handleCancelDownload();
                                            }}
                                            hitSlop={8}
                                            style={{
                                                flexDirection: 'row',
                                                alignItems: 'center',
                                                padding: 6,
                                                borderRadius: 6,
                                                gap: 4,
                                            }}
                                        >
                                            <Text style={{
                                                fontSize: 12,
                                                color: theme.colors.textSecondary,
                                                ...Typography.default()
                                            }}>
                                                {downloadProgress.percent}%
                                            </Text>
                                            <Octicons name="x" size={14} color={theme.colors.textDestructive} />
                                        </Pressable>
                                    ) : (
                                        <Pressable
                                            onPress={(e) => {
                                                e.stopPropagation();
                                                handleDownloadFile(entry);
                                            }}
                                            disabled={downloadProgress !== null}
                                            hitSlop={8}
                                            style={{
                                                padding: 6,
                                                borderRadius: 6,
                                                opacity: downloadProgress !== null ? 0.3 : 1,
                                            }}
                                        >
                                            <Octicons name="download" size={16} color={theme.colors.textSecondary} />
                                        </Pressable>
                                    )
                                }
                            />
                        ))}
                    </>
                )}
            </ItemList>
        </View>
    );
}

// Route wrapper for standalone file explorer screen
export default function FilesScreen() {
    const route = useRoute();
    const sessionId = (route.params! as any).id as string;
    return <FileExplorerContent sessionId={sessionId} />;
}

const styles = StyleSheet.create((theme) => ({
    container: {
        flex: 1,
        maxWidth: layout.maxWidth,
        alignSelf: 'center',
        width: '100%',
    }
}));
