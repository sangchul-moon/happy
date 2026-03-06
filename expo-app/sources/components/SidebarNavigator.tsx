import { useAuth } from '@/auth/AuthContext';
import * as React from 'react';
import { Drawer } from 'expo-router/drawer';
import { useIsTablet } from '@/utils/responsive';
import { SidebarView } from './SidebarView';
import { View } from 'react-native';
import { SplitViewContainer } from './SplitViewContainer';
import { StyleSheet } from 'react-native-unistyles';
import { useSplitViewActive } from '@/hooks/useSplitView';

export const SidebarNavigator = React.memo(() => {
    const auth = useAuth();
    const isTablet = useIsTablet();
    const showDesktopLayout = auth.isAuthenticated && isTablet;
    const hasPanels = useSplitViewActive();

    // Phone layout: use Drawer navigator
    if (!showDesktopLayout) {
        return (
            <Drawer
                screenOptions={{
                    lazy: false,
                    headerShown: false,
                    drawerType: 'front' as const,
                    swipeEnabled: false,
                    drawerStyle: {
                        width: 0,
                        display: 'none' as const,
                    },
                }}
            />
        );
    }

    // Desktop/tablet layout: sidebar + content with Drawer for routing
    return (
        <View style={styles.container}>
            <View style={styles.sidebar}>
                <SidebarView />
            </View>
            <View style={styles.content}>
                {/* Drawer handles routing (hidden drawer panel, only Slot renders) */}
                <Drawer
                    screenOptions={{
                        lazy: false,
                        headerShown: false,
                        drawerType: 'front' as const,
                        swipeEnabled: false,
                        drawerStyle: {
                            width: 0,
                            display: 'none' as const,
                        },
                    }}
                />
                {/* SplitViewContainer overlays when panels exist */}
                {hasPanels && (
                    <View style={styles.splitOverlay}>
                        <SplitViewContainer />
                    </View>
                )}
            </View>
        </View>
    );
});

const styles = StyleSheet.create((theme) => ({
    container: {
        flex: 1,
        flexDirection: 'row',
    },
    sidebar: {
        width: 320,
        borderRightWidth: StyleSheet.hairlineWidth,
        borderRightColor: theme.colors.divider,
    },
    content: {
        flex: 1,
        overflow: 'hidden',
        backgroundColor: theme.colors.surface,
    },
    splitOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: theme.colors.surface,
    },
}));
