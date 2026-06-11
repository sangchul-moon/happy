/**
 * Split View Container
 *
 * Renders session panels as the main content area on tablet/desktop.
 * Shows an empty state when no session is selected.
 */

import * as React from 'react';
import { View } from 'react-native';
import { Text } from '@/components/StyledText';
import { StyleSheet } from 'react-native-unistyles';
import { SplitPanel } from './SplitPanel';
import { useSplitViewPanels } from '@/hooks/useSplitView';
import { Typography } from '@/constants/Typography';

export const SplitViewContainer = React.memo(() => {
    const panels = useSplitViewPanels();

    if (panels.length === 0) {
        return (
            <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>
                    Select a session
                </Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {panels.map((sessionId, index) => (
                <SplitPanel
                    key={sessionId}
                    sessionId={sessionId}
                    isLast={index === panels.length - 1}
                />
            ))}
        </View>
    );
});

const styles = StyleSheet.create((theme) => ({
    container: {
        flex: 1,
        flexDirection: 'row',
        backgroundColor: theme.colors.surface,
    },
    emptyState: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.surface,
    },
    emptyStateText: {
        fontSize: 16,
        color: theme.colors.textSecondary,
        ...Typography.default(),
    },
}));
