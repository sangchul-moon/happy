/**
 * Split View Container
 *
 * Renders multiple session panels side by side.
 * Dynamically adjusts layout based on panel count.
 * Only active on web platform when panels are open.
 */

import * as React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { SplitPanel } from './SplitPanel';
import { useSplitViewPanels } from '@/hooks/useSplitView';

export const SplitViewContainer = React.memo(() => {
    const panels = useSplitViewPanels();

    if (panels.length === 0) {
        return null;
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
}));
