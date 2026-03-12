import React from 'react';
import { View, Pressable, TouchableOpacity, Platform, ActivityIndicator } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Text } from '@/components/StyledText';
import { router, useRouter } from 'expo-router';
import { Session, Machine } from '@/sync/storageTypes';
import { Ionicons } from '@expo/vector-icons';
import { getSessionName, useSessionStatus, formatPathRelativeToHome } from '@/utils/sessionUtils';
import { Typography } from '@/constants/Typography';
import { StatusDot } from './StatusDot';
import { useAllMachines, useSetting } from '@/sync/storage';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { isMachineOnline } from '@/utils/machineUtils';
import { machineSpawnNewSession, sessionKill, sessionAllow, sessionDeny } from '@/sync/ops';
import { resolveAbsolutePath } from '@/utils/pathUtils';
import { storage } from '@/sync/storage';
import { Modal } from '@/modal';
import { t } from '@/text';
import { useNavigateToSession } from '@/hooks/useNavigateToSession';
import { useIsTablet } from '@/utils/responsive';
import { ProjectGitStatus } from './ProjectGitStatus';
import { useHappyAction } from '@/hooks/useHappyAction';
import { HappyError } from '@/utils/errors';

function hexToRgba(hex: string, alpha: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const stylesheet = StyleSheet.create((theme, runtime) => ({
    container: {
        backgroundColor: theme.colors.groupped.background,
        paddingTop: 8,
    },
    projectCard: {
        backgroundColor: theme.colors.surface,
        marginBottom: 8,
        marginHorizontal: Platform.select({ ios: 16, default: 12 }),
        borderRadius: Platform.select({ ios: 10, default: 16 }),
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: theme.colors.divider,
    },
    sectionHeader: {
        paddingTop: 8,
        paddingBottom: Platform.select({ ios: 4, default: 6 }),
        paddingHorizontal: Platform.select({ ios: 32, default: 24 }),
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    sectionHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginRight: 8,
    },
    sectionHeaderPath: {
        ...Typography.default('regular'),
        color: theme.colors.groupped.sectionTitle,
        fontSize: Platform.select({ ios: 13, default: 14 }),
        lineHeight: Platform.select({ ios: 18, default: 20 }),
        letterSpacing: Platform.select({ ios: -0.08, default: 0.1 }),
        fontWeight: Platform.select({ ios: 'normal', default: '500' }),
        flex: 1,
    },
    sessionRow: {
        height: 56,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        backgroundColor: theme.colors.surface,
    },
    sessionRowWithBorder: {
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: theme.colors.divider,
    },
    sessionRowSelected: {
        backgroundColor: theme.colors.surfaceSelected,
    },
    sessionContent: {
        flex: 1,
        justifyContent: 'center',
    },
    sessionTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    sessionTitle: {
        fontSize: 15,
        flex: 1,
        ...Typography.default('regular'),
    },
    sessionTitleConnected: {
        color: theme.colors.text,
    },
    sessionTitleDisconnected: {
        color: theme.colors.textSecondary,
    },
    statusDotContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        width: 16,
        height: 16,
    },
    newSessionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-start',
        height: 56,
        paddingHorizontal: 16,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: theme.colors.divider,
        backgroundColor: theme.colors.surface,
    },
    newSessionButtonDisabled: {
        opacity: 0.4,
    },
    newSessionButtonContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    newSessionButtonIcon: {
        marginRight: 8,
        width: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    newSessionButtonText: {
        fontSize: 15,
        color: theme.colors.textSecondary,
        ...Typography.default('regular'),
    },
    swipeAction: {
        width: 112,
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.status.error,
    },
    swipeActionText: {
        marginTop: 4,
        fontSize: 12,
        color: '#FFFFFF',
        textAlign: 'center',
        ...Typography.default('semiBold'),
    },
    permissionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingBottom: 8,
        gap: 8,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: theme.colors.divider,
    },
    permissionToolName: {
        flex: 1,
        fontSize: 11,
        color: theme.colors.textSecondary,
        ...Typography.default(),
    },
    permissionButton: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 4,
    },
    permissionAllowButton: {
        backgroundColor: hexToRgba(theme.colors.status.connected, 0.19),
    },
    permissionAllEditsButton: {
        backgroundColor: hexToRgba(theme.colors.textLink, 0.19),
    },
    permissionDenyButton: {
        backgroundColor: hexToRgba(theme.colors.status.error, 0.19),
    },
    permissionButtonText: {
        fontSize: 10,
        fontWeight: '500',
        ...Typography.default('semiBold'),
    },
    permissionAllowText: {
        color: theme.colors.status.connected,
    },
    permissionAllEditsText: {
        color: theme.colors.textLink,
    },
    permissionDenyText: {
        color: theme.colors.status.error,
    },
}));

interface ActiveSessionsGroupProps {
    sessions: Session[];
    selectedSessionId?: string;
}


export function ActiveSessionsGroupCompact({ sessions, selectedSessionId }: ActiveSessionsGroupProps) {
    const styles = stylesheet;
    const machines = useAllMachines();

    const machinesMap = React.useMemo(() => {
        const map: Record<string, Machine> = {};
        machines.forEach(machine => {
            map[machine.id] = machine;
        });
        return map;
    }, [machines]);

    // Group sessions by project, then associate with machine
    const projectGroups = React.useMemo(() => {
        const groups = new Map<string, {
            path: string;
            displayPath: string;
            machines: Map<string, {
                machine: Machine | null;
                machineName: string;
                sessions: Session[];
            }>;
        }>();

        sessions.forEach(session => {
            const projectPath = session.metadata?.path || '';
            const unknownText = t('status.unknown');
            const machineId = session.metadata?.machineId || unknownText;

            // Get machine info
            const machine = machineId !== unknownText ? machinesMap[machineId] : null;
            const machineName = machine?.metadata?.displayName ||
                machine?.metadata?.host ||
                (machineId !== unknownText ? machineId : `<${unknownText}>`);

            // Get or create project group
            let projectGroup = groups.get(projectPath);
            if (!projectGroup) {
                const displayPath = formatPathRelativeToHome(projectPath, session.metadata?.homeDir);
                projectGroup = {
                    path: projectPath,
                    displayPath,
                    machines: new Map()
                };
                groups.set(projectPath, projectGroup);
            }

            // Get or create machine group within project
            let machineGroup = projectGroup.machines.get(machineId);
            if (!machineGroup) {
                machineGroup = {
                    machine,
                    machineName,
                    sessions: []
                };
                projectGroup.machines.set(machineId, machineGroup);
            }

            // Add session to machine group
            machineGroup.sessions.push(session);
        });

        // Sort sessions within each machine group by creation time (newest first)
        groups.forEach(projectGroup => {
            projectGroup.machines.forEach(machineGroup => {
                machineGroup.sessions.sort((a, b) => b.createdAt - a.createdAt);
            });
        });

        return groups;
    }, [sessions, machinesMap]);

    // Sort project groups by display path
    const sortedProjectGroups = React.useMemo(() => {
        return Array.from(projectGroups.entries()).sort(([, groupA], [, groupB]) => {
            return groupA.displayPath.localeCompare(groupB.displayPath);
        });
    }, [projectGroups]);

    return (
        <View style={styles.container}>
            {sortedProjectGroups.map(([projectPath, projectGroup]) => {

                const firstSession = Array.from(projectGroup.machines.values())[0]?.sessions[0];

                return (
                    <View key={projectPath}>
                        {/* Card with just the sessions */}
                        <View style={styles.projectCard}>
                            {/* Sessions grouped by machine within the card */}
                            {Array.from(projectGroup.machines.entries())
                                .sort(([, machineA], [, machineB]) => machineA.machineName.localeCompare(machineB.machineName))
                                .map(([machineId, machineGroup]) => (
                                    <View key={`${projectPath}-${machineId}`}>
                                        {machineGroup.sessions.map((session, index) => (
                                            <CompactSessionRow
                                                key={session.id}
                                                session={session}
                                                selected={selectedSessionId === session.id}
                                                showBorder={index < machineGroup.sessions.length - 1 ||
                                                    Array.from(projectGroup.machines.keys()).indexOf(machineId) < projectGroup.machines.size - 1}
                                            />
                                        ))}
                                    </View>
                                ))}
                        </View>
                    </View>
                );
            })}
        </View>
    );
}

/** Hook to find the latest pending permission from session agentState (persists across refresh) */
function usePendingPermission(session: Session) {
    return React.useMemo(() => {
        const requests = session.agentState?.requests;
        if (!requests) return null;
        const ids = Object.keys(requests);
        if (ids.length === 0) return null;
        const id = ids[0];
        const req = requests[id];
        return { id, toolName: req.tool, input: req.arguments, description: undefined as string | undefined };
    }, [session.agentState?.requests]);
}

// Compact session row component with status line
const CompactSessionRow = React.memo(({ session, selected, showBorder }: { session: Session; selected?: boolean; showBorder?: boolean }) => {
    const styles = stylesheet;
    const { theme } = useUnistyles();
    const sessionStatus = useSessionStatus(session);
    const sessionName = getSessionName(session);
    const navigateToSession = useNavigateToSession();
    const isTablet = useIsTablet();
    const swipeableRef = React.useRef<Swipeable | null>(null);
    const swipeEnabled = Platform.OS !== 'web';
    const pendingPermission = usePendingPermission(session);
    const [permissionLoading, setPermissionLoading] = React.useState<'allow' | 'allEdits' | 'deny' | null>(null);
    const isEditTool = pendingPermission && ['Edit', 'MultiEdit', 'Write', 'NotebookEdit', 'ExitPlanMode', 'exit_plan_mode'].includes(pendingPermission.toolName);

    const [archivingSession, performArchive] = useHappyAction(async () => {
        const result = await sessionKill(session.id);
        if (!result.success) {
            throw new HappyError(result.message || t('sessionInfo.failedToArchiveSession'), false);
        }
    });

    const handleArchive = React.useCallback(() => {
        swipeableRef.current?.close();
        Modal.alert(
            t('sessionInfo.archiveSession'),
            t('sessionInfo.archiveSessionConfirm'),
            [
                { text: t('common.cancel'), style: 'cancel' },
                {
                    text: t('sessionInfo.archiveSession'),
                    style: 'destructive',
                    onPress: performArchive
                }
            ]
        );
    }, [performArchive]);

    const itemContent = (
        <View>
        <Pressable
            style={[
                styles.sessionRow,
                showBorder && !pendingPermission && styles.sessionRowWithBorder,
                selected && styles.sessionRowSelected
            ]}
            onPressIn={() => {
                if (isTablet) {
                    navigateToSession(session.id);
                }
            }}
            onPress={() => {
                if (!isTablet) {
                    navigateToSession(session.id);
                }
            }}
        >
            <View style={styles.sessionContent}>
                {/* Title line with status */}
                <View style={styles.sessionTitleRow}>
                    {/* Status dot or draft icon on the left */}
                    {(() => {
                        // Show draft icon when online with draft
                        if (sessionStatus.state === 'waiting' && session.draft) {
                            return (
                                <Ionicons
                                    name="create-outline"
                                    size={14}
                                    color={theme.colors.textSecondary}
                                    style={{ marginRight: 8 }}
                                />
                            );
                        }

                        // Show status dot only for permission_required/thinking states
                        if (sessionStatus.state === 'permission_required' || sessionStatus.state === 'thinking') {
                            return (
                                <View style={[styles.statusDotContainer, { marginRight: 8 }]}>
                                    <StatusDot
                                        color={sessionStatus.statusDotColor}
                                        isPulsing={sessionStatus.isPulsing}
                                    />
                                </View>
                            );
                        }

                        // Show grey dot for online without draft
                        if (sessionStatus.state === 'waiting') {
                            return (
                                <View style={[styles.statusDotContainer, { marginRight: 8 }]}>
                                    <StatusDot
                                        color={theme.colors.textSecondary}
                                        isPulsing={false}
                                    />
                                </View>
                            );
                        }

                        return null;
                    })()}

                    <Text
                        style={[
                            styles.sessionTitle,
                            sessionStatus.isConnected ? styles.sessionTitleConnected : styles.sessionTitleDisconnected
                        ]}
                        numberOfLines={2}
                    >
                        {sessionName}
                    </Text>
                </View>
            </View>
        </Pressable>
        {pendingPermission && (
            <View style={[styles.permissionRow, showBorder && styles.sessionRowWithBorder]}>
                <Text style={styles.permissionToolName} numberOfLines={1}>
                    {pendingPermission.toolName}
                    {pendingPermission.input?.file_path ? `: ${pendingPermission.input.file_path.split('/').pop()}` :
                     pendingPermission.input?.command ? `: ${pendingPermission.input.command}` :
                     pendingPermission.input?.pattern ? `: ${pendingPermission.input.pattern}` :
                     pendingPermission.description ? `: ${pendingPermission.description}` : ''}
                </Text>
                <TouchableOpacity
                    activeOpacity={0.7}
                    style={{ backgroundColor: hexToRgba(theme.colors.status.connected, 0.19), paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 }}
                    onPress={async () => {
                        if (permissionLoading) return;
                        setPermissionLoading('allow');
                        try {
                            await sessionAllow(session.id, pendingPermission.id);
                        } finally {
                            setPermissionLoading(null);
                        }
                    }}
                    disabled={permissionLoading !== null}
                >
                    {permissionLoading === 'allow' ? (
                        <ActivityIndicator size="small" color={theme.colors.status.connected} />
                    ) : (
                        <Text style={[styles.permissionButtonText, styles.permissionAllowText]}>Allow</Text>
                    )}
                </TouchableOpacity>
                <TouchableOpacity
                    activeOpacity={0.7}
                    style={{ backgroundColor: hexToRgba(theme.colors.textLink, 0.19), paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 }}
                    onPress={async () => {
                        if (permissionLoading) return;
                        setPermissionLoading('allEdits');
                        try {
                            if (isEditTool) {
                                await sessionAllow(session.id, pendingPermission.id, 'acceptEdits');
                                storage.getState().updateSessionPermissionMode(session.id, 'acceptEdits');
                            } else {
                                let toolIdentifier = pendingPermission.toolName;
                                if (pendingPermission.toolName === 'Bash' && pendingPermission.input?.command) {
                                    toolIdentifier = `Bash(${pendingPermission.input.command})`;
                                }
                                await sessionAllow(session.id, pendingPermission.id, undefined, [toolIdentifier]);
                            }
                        } finally {
                            setPermissionLoading(null);
                        }
                    }}
                    disabled={permissionLoading !== null}
                >
                    {permissionLoading === 'allEdits' ? (
                        <ActivityIndicator size="small" color={theme.colors.textLink} />
                    ) : (
                        <Text style={[styles.permissionButtonText, styles.permissionAllEditsText]}>
                            {isEditTool ? 'All Edits' : 'Always'}
                        </Text>
                    )}
                </TouchableOpacity>
                <TouchableOpacity
                    activeOpacity={0.7}
                    style={{ backgroundColor: hexToRgba(theme.colors.status.error, 0.19), paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 }}
                    onPress={async () => {
                        if (permissionLoading) return;
                        setPermissionLoading('deny');
                        try {
                            await sessionDeny(session.id, pendingPermission.id);
                        } finally {
                            setPermissionLoading(null);
                        }
                    }}
                    disabled={permissionLoading !== null}
                >
                    {permissionLoading === 'deny' ? (
                        <ActivityIndicator size="small" color={theme.colors.status.error} />
                    ) : (
                        <Text style={[styles.permissionButtonText, styles.permissionDenyText]}>Deny</Text>
                    )}
                </TouchableOpacity>
            </View>
        )}
        </View>
    );

    if (!swipeEnabled) {
        return itemContent;
    }

    const renderRightActions = () => (
        <Pressable
            style={styles.swipeAction}
            onPress={handleArchive}
            disabled={archivingSession}
        >
            <Ionicons name="archive-outline" size={20} color="#FFFFFF" />
            <Text style={styles.swipeActionText} numberOfLines={2}>
                {t('sessionInfo.archiveSession')}
            </Text>
        </Pressable>
    );

    return (
        <Swipeable
            ref={swipeableRef}
            renderRightActions={renderRightActions}
            overshootRight={false}
            enabled={!archivingSession}
        >
            {itemContent}
        </Swipeable>
    );
});
