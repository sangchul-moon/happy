/**
 * FileAttachment
 *
 * Displays attached files above the input field with upload status.
 */

import * as React from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Typography } from '@/constants/Typography';
import { UploadedFile, formatFileSize } from '@/hooks/useFileUpload';
import { t } from '@/text';

interface FileAttachmentProps {
    files: UploadedFile[];
    onRemove: (fileId: string) => void;
    onRetry?: (file: UploadedFile) => void;
}

export const FileAttachment = React.memo<FileAttachmentProps>(({ files, onRemove, onRetry }) => {
    const { theme } = useUnistyles();

    if (files.length === 0) {
        return null;
    }

    return (
        <View style={styles.container}>
            {files.map((file) => (
                <View key={file.id} style={styles.fileItem}>
                    <View style={styles.fileInfo}>
                        {/* Icon based on status */}
                        {file.status === 'uploading' ? (
                            <ActivityIndicator size="small" color={theme.colors.text} style={styles.icon} />
                        ) : file.status === 'success' ? (
                            <Ionicons name="checkmark-circle" size={18} color={theme.colors.success} style={styles.icon} />
                        ) : file.status === 'error' ? (
                            <Ionicons name="alert-circle" size={18} color={theme.colors.warning} style={styles.icon} />
                        ) : (
                            <Ionicons name="document-outline" size={18} color={theme.colors.text} style={styles.icon} />
                        )}

                        {/* File name and size */}
                        <View style={styles.fileDetails}>
                            <Text style={styles.fileName} numberOfLines={1}>
                                {file.fileName}
                            </Text>
                            <Text style={styles.fileSize}>
                                {formatFileSize(file.size)}
                                {file.status === 'uploading' && ` - ${t('fileAttachment.uploading')}`}
                                {file.status === 'success' && ` - ${t('fileAttachment.uploaded')}`}
                                {file.status === 'error' && ` - ${file.error || t('fileAttachment.failed')}`}
                            </Text>
                        </View>
                    </View>

                    {/* Actions */}
                    <View style={styles.actions}>
                        {file.status === 'error' && onRetry && (
                            <Pressable
                                onPress={() => onRetry(file)}
                                style={({ pressed }) => [
                                    styles.actionButton,
                                    pressed && styles.actionButtonPressed
                                ]}
                                hitSlop={8}
                            >
                                <Ionicons name="refresh" size={16} color={theme.colors.textSecondary} />
                            </Pressable>
                        )}
                        {file.status !== 'uploading' && (
                            <Pressable
                                onPress={() => onRemove(file.id)}
                                style={({ pressed }) => [
                                    styles.actionButton,
                                    pressed && styles.actionButtonPressed
                                ]}
                                hitSlop={8}
                            >
                                <Ionicons name="close" size={18} color={theme.colors.textSecondary} />
                            </Pressable>
                        )}
                    </View>
                </View>
            ))}
        </View>
    );
});

const styles = StyleSheet.create((theme) => ({
    container: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        gap: 4,
    },
    fileItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: theme.colors.surfaceHigh,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    fileInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        minWidth: 0,
    },
    icon: {
        marginRight: 8,
    },
    fileDetails: {
        flex: 1,
        minWidth: 0,
    },
    fileName: {
        fontSize: 14,
        color: theme.colors.text,
        ...Typography.default('semiBold'),
    },
    fileSize: {
        fontSize: 12,
        color: theme.colors.textSecondary,
        marginTop: 2,
        ...Typography.default(),
    },
    actions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginLeft: 8,
    },
    actionButton: {
        padding: 4,
    },
    actionButtonPressed: {
        opacity: 0.5,
    },
}));
