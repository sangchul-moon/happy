import { useAuth } from '@/auth/AuthContext';
import * as React from 'react';
import { Drawer } from 'expo-router/drawer';
import { useIsTablet, useHeaderHeight } from '@/utils/responsive';
import { SidebarView } from './SidebarView';
import { useWindowDimensions, View, Pressable, Platform } from 'react-native';
import { useLocalSetting, useLocalSettingMutable, storage } from '@/sync/storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useUnistyles } from 'react-native-unistyles';
import { t } from '@/text';
import { isTauri } from '@/utils/isTauri';
import { hydrateSplitViewPanels } from '@/hooks/useSplitView';

export const SidebarNavigator = React.memo(() => {
    const auth = useAuth();
    const isTablet = useIsTablet();
    const zenMode = useLocalSetting('zenMode');
    const isDesktopLayout = auth.isAuthenticated && isTablet;
    const showSidebar = isDesktopLayout && !zenMode;
    const { width: windowWidth } = useWindowDimensions();

    // Restore persisted split-view panels once after mount.
    React.useEffect(() => {
        hydrateSplitViewPanels();
    }, []);

    // Escape exits zen mode globally (web only). The sidebar — including the
    // zen toggle next to Settings — is hidden while zen is on, so this is the
    // way out even when no session view is mounted.
    React.useEffect(() => {
        if (Platform.OS !== 'web' || !zenMode) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                storage.getState().applyLocalSettings({ zenMode: false });
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [zenMode]);

    // Calculate target drawer width
    const fullDrawerWidth = React.useMemo(() => {
        if (!isDesktopLayout) return 280;
        return Math.min(Math.max(Math.floor(windowWidth * 0.3), 250), 360);
    }, [windowWidth, isDesktopLayout]);
    const drawerWidth = showSidebar ? fullDrawerWidth : 0;

    const drawerNavigationOptions = React.useMemo(() => {
        if (!isDesktopLayout) {
            // Non-tablet: use front drawer, hidden
            return {
                lazy: false,
                headerShown: false,
                drawerType: 'front' as const,
                swipeEnabled: false,
                drawerStyle: {
                    width: 0,
                    display: 'none' as const,
                },
            };
        }

        // Tablet: always permanent, just collapse width in zen mode.
        //
        // We deliberately do NOT animate `width` on web. A CSS transition on
        // the drawer width re-flowed the chat flex-1 sibling on every frame,
        // re-measuring the entire FlatList tree at ~15fps. Snapping the
        // width change makes the chat reflow exactly once. Native already
        // snaps because RN doesn't honor CSS transition properties.
        return {
            lazy: false,
            headerShown: false,
            drawerType: 'permanent' as const,
            drawerStyle: {
                backgroundColor: 'white',
                borderRightWidth: 0,
                width: drawerWidth,
                overflow: 'hidden' as const,
            } as any,
            swipeEnabled: false,
            drawerActiveTintColor: 'transparent',
            drawerInactiveTintColor: 'transparent',
            drawerItemStyle: { display: 'none' as const },
            drawerLabelStyle: { display: 'none' as const },
        };
    }, [isDesktopLayout, drawerWidth]);

    const drawerContent = React.useCallback(
        () => <SidebarView />,
        []
    );

    return (
        <View style={{ flex: 1 }}>
            <Drawer
                screenOptions={drawerNavigationOptions}
                drawerContent={isDesktopLayout ? drawerContent : undefined}
            />
            {/* Persistent header overlay — always visible on desktop, same position regardless of zen mode */}
            {isDesktopLayout && (
                <PersistentHeader />
            )}
            {/* Floating button to bring the sidebar back while zen mode hides it */}
            {isDesktopLayout && zenMode && (
                <FloatingZenExit />
            )}
        </View>
    );
});

// Floating button shown only while zen mode hides the sidebar — sits at the
// bottom-left, mirroring the collapse chevron next to Settings, so the toggle
// stays in the same spot whether the sidebar is open or hidden (Escape works
// too).
const FloatingZenExit = React.memo(() => {
    const { theme } = useUnistyles();
    const safeArea = useSafeAreaInsets();
    const [, setZenMode] = useLocalSettingMutable('zenMode');

    return (
        <Pressable
            onPress={() => setZenMode(false)}
            hitSlop={10}
            accessibilityLabel={t('zen.toggle')}
            style={{
                position: 'absolute',
                bottom: safeArea.bottom + 12,
                left: 12,
                width: 32,
                height: 32,
                borderRadius: 16,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: theme.colors.surface,
                shadowColor: theme.colors.shadow.color,
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: theme.colors.shadow.opacity,
                shadowRadius: 3,
                zIndex: 1200,
            }}
        >
            <Ionicons name="chevron-forward" size={18} color={theme.colors.text} />
        </Pressable>
    );
});

// Invisible top strip kept as the Tauri window drag region (overlay titlebar).
// The zen toggle lives next to Settings at the bottom of the sidebar; the
// back/forward navigation buttons were removed.
const PersistentHeader = React.memo(() => {
    const safeArea = useSafeAreaInsets();
    const headerHeight = useHeaderHeight();
    const inTauri = isTauri();

    return (
        <View
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: safeArea.top + headerHeight,
                zIndex: 1100,
            }}
            pointerEvents="box-none"
            {...(inTauri ? { dataSet: { tauriDragRegion: 'true' } } : {})}
        />
    );
});
