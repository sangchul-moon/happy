import * as React from 'react';
import { View, Modal, Pressable, useWindowDimensions } from 'react-native';
import { Octicons } from '@expo/vector-icons';
import { Text } from '@/components/StyledText';
import { Typography } from '@/constants/Typography';
import { useUnistyles } from 'react-native-unistyles';
import { FileExplorerContent } from '@/app/(app)/session/[id]/files';

interface FileExplorerSheetProps {
    visible: boolean;
    sessionId: string;
    onClose: () => void;
}

export const FileExplorerSheet: React.FC<FileExplorerSheetProps> = ({ visible, sessionId, onClose }) => {
    const { theme } = useUnistyles();
    const { height } = useWindowDimensions();
    const sheetHeight = Math.round(height * 0.7);

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <View style={{ flex: 1, justifyContent: 'flex-end', alignItems: 'center' }}>
                {/* Backdrop */}
                <Pressable
                    style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)' }}
                    onPress={onClose}
                />

                {/* Sheet */}
                <View style={{
                    height: sheetHeight,
                    width: '100%',
                    maxWidth: 520,
                    backgroundColor: theme.colors.surface,
                    borderTopLeftRadius: 16,
                    borderTopRightRadius: 16,
                    overflow: 'hidden',
                }}>
                    {/* Handle bar + header */}
                    <View style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingHorizontal: 16,
                        paddingTop: 12,
                        paddingBottom: 8,
                        borderBottomWidth: 0.33,
                        borderBottomColor: theme.colors.divider,
                    }}>
                        {/* Drag handle */}
                        <View style={{
                            position: 'absolute',
                            top: 6,
                            left: 0,
                            right: 0,
                            alignItems: 'center',
                        }}>
                            <View style={{
                                width: 36,
                                height: 4,
                                borderRadius: 2,
                                backgroundColor: theme.colors.textSecondary,
                                opacity: 0.3,
                            }} />
                        </View>

                        <Octicons name="file-directory" size={18} color={theme.colors.text} style={{ marginRight: 8 }} />
                        <Text style={{
                            flex: 1,
                            fontSize: 16,
                            fontWeight: '600',
                            color: theme.colors.text,
                            ...Typography.default('semiBold')
                        }}>
                            Files
                        </Text>
                        <Pressable
                            onPress={onClose}
                            hitSlop={12}
                            style={{
                                padding: 4,
                                borderRadius: 12,
                                backgroundColor: theme.colors.input.background,
                            }}
                        >
                            <Octicons name="x" size={16} color={theme.colors.textSecondary} />
                        </Pressable>
                    </View>

                    {/* File explorer content */}
                    <FileExplorerContent sessionId={sessionId} onNavigate={onClose} />
                </View>
            </View>
        </Modal>
    );
};
