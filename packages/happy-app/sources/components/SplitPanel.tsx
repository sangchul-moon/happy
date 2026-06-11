/**
 * Split Panel Component
 *
 * Wraps a SessionView in a split view panel with controls.
 * Provides close button and visual separator for multi-panel layouts.
 * Only rendered on web platform.
 */

import * as React from 'react';
import { Pressable, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Ionicons } from '@expo/vector-icons';
import { SessionView } from '@/-session/SessionView';
import { useSplitViewStore } from '@/hooks/useSplitView';

interface SplitPanelProps {
    sessionId: string;
    isLast: boolean;
}

export const SplitPanel = React.memo(({ sessionId, isLast }: SplitPanelProps) => {
    const removePanel = useSplitViewStore(state => state.removePanel);

    const handleClose = React.useCallback(() => {
        removePanel(sessionId);
    }, [removePanel, sessionId]);

    return (
        <View style={styles.container}>
            {/* Close button overlay */}
            <View style={styles.closeButtonContainer}>
                <Pressable
                    onPress={handleClose}
                    style={styles.closeButton}
                    hitSlop={8}
                >
                    <Ionicons name="close" size={16} color="#666" />
                </Pressable>
            </View>

            {/* Session content */}
            <View style={styles.content}>
                <SessionView id={sessionId} />
            </View>

            {/* Separator between panels */}
            {!isLast && <View style={styles.separator} />}
        </View>
    );
});

const styles = StyleSheet.create((theme) => ({
    container: {
        flex: 1,
        flexDirection: 'row',
        position: 'relative',
    },
    closeButtonContainer: {
        position: 'absolute',
        top: 8,
        right: 8,
        zIndex: 1001,
    },
    closeButton: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: theme.colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: theme.colors.shadow.color,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: theme.colors.shadow.opacity * 0.5,
        shadowRadius: 2,
    },
    content: {
        flex: 1,
        overflow: 'hidden',
    },
    separator: {
        width: 1,
        backgroundColor: theme.colors.divider,
    },
}));
