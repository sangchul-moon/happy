import * as React from 'react';
import { Text, View, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { VoiceAssistantStatusBar } from './VoiceAssistantStatusBar';
import { useRealtimeStatus, useLocalSettingMutable } from '@/sync/storage';
import { MainView } from './MainView';
import { StyleSheet } from 'react-native-unistyles';
import { t } from '@/text';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '@/constants/Typography';

const stylesheet = StyleSheet.create((theme) => ({
    container: {
        flex: 1,
        borderStyle: 'solid',
        backgroundColor: theme.colors.groupped.background,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: theme.colors.divider,
    },
    newSessionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: 16,
        marginTop: 8,
        marginBottom: 4,
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 10,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: theme.colors.divider,
        backgroundColor: theme.colors.surface,
        gap: 8,
    },
    newSessionButtonPressed: {
        backgroundColor: theme.colors.surfacePressed,
    },
    newSessionText: {
        fontSize: 14,
        fontWeight: '500',
        color: theme.colors.text,
        ...Typography.default('semiBold'),
    },
    bottomRow: {
        flexDirection: 'row',
        alignItems: 'center',
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: theme.colors.divider,
    },
    settingsRow: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 14,
        gap: 10,
    },
    zenButton: {
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 4,
    },
    settingsText: {
        fontSize: 14,
        fontWeight: '500',
        color: theme.colors.text,
        ...Typography.default(),
    },
}));

export const SidebarView = React.memo(() => {
    const styles = stylesheet;
    const safeArea = useSafeAreaInsets();
    const router = useRouter();
    const realtimeStatus = useRealtimeStatus();
    const [zenMode, setZenMode] = useLocalSettingMutable('zenMode');

    const handleNewSession = React.useCallback(() => {
        router.navigate('/new');
    }, [router]);

    const handleZenToggle = React.useCallback(() => {
        setZenMode(!zenMode);
    }, [zenMode, setZenMode]);

    return (
        <View style={[styles.container, { paddingTop: safeArea.top + 8 }]}>
            {/* New Session button */}
            <Pressable
                onPress={handleNewSession}
                style={({ pressed }) => [
                    styles.newSessionButton,
                    pressed && styles.newSessionButtonPressed,
                ]}
            >
                <Ionicons name="create-outline" size={16} color={stylesheet.newSessionText.color} />
                <Text style={styles.newSessionText}>{t('sidebar.newSession')}</Text>
            </Pressable>

            {realtimeStatus !== 'disconnected' && (
                <VoiceAssistantStatusBar variant="sidebar" />
            )}

            {/* Sessions list */}
            <MainView variant="sidebar" />

            {/* Settings + zen toggle at bottom */}
            <View style={styles.bottomRow}>
                <Pressable
                    onPress={() => router.push('/settings')}
                    style={styles.settingsRow}
                >
                    <Ionicons name="settings-outline" size={18} color={stylesheet.settingsText.color} />
                    <Text style={styles.settingsText}>{t('settings.title')}</Text>
                </Pressable>
                <Pressable
                    onPress={handleZenToggle}
                    hitSlop={10}
                    style={styles.zenButton}
                    accessibilityLabel={t('zen.toggle')}
                >
                    <Ionicons name="chevron-back" size={18} color={stylesheet.settingsText.color} />
                </Pressable>
            </View>
        </View>
    );
});
