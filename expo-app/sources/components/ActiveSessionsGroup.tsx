import React from 'react';
import { View, Pressable, TouchableOpacity, Platform, ActivityIndicator } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Text } from '@/components/StyledText';
import { useRouter } from 'expo-router';
import { Session, Machine } from '@/sync/storageTypes';
import { Ionicons } from '@expo/vector-icons';
import { getSessionName, useSessionStatus, formatPathRelativeToHome, getSessionActivityText } from '@/utils/sessionUtils';
import { Typography } from '@/constants/Typography';
import { StatusDot } from './StatusDot';
import { useAllMachines, useSetting } from '@/sync/storage';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { isMachineOnline } from '@/utils/machineUtils';
import { machineSpawnNewSession, sessionKill, sessionAllow, sessionDeny } from '@/sync/ops';
import { storage } from '@/sync/storage';
import { Modal } from '@/modal';
import { CompactGitStatus } from './CompactGitStatus';
import { ProjectGitStatus } from './ProjectGitStatus';
import { t } from '@/text';
import { useNavigateToSession } from '@/hooks/useNavigateToSession';
import { useIsTablet } from '@/utils/responsive';
import { useHappyAction } from '@/hooks/useHappyAction';
import { HappyError } from '@/utils/errors';
import { useSplitViewStore } from '@/hooks/useSplitView';

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
    },
    sectionHeaderMachine: {
        ...Typography.default('regular'),
        color: theme.colors.groupped.sectionTitle,
        fontSize: Platform.select({ ios: 13, default: 14 }),
        lineHeight: Platform.select({ ios: 18, default: 20 }),
        letterSpacing: Platform.select({ ios: -0.08, default: 0.1 }),
        fontWeight: Platform.select({ ios: 'normal', default: '500' }),
        maxWidth: 150,
        textAlign: 'right',
    },
    sessionRow: {
        height: 52,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        backgroundColor: theme.colors.surface,
    },
    sessionRowWithBorder: {
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: theme.colors.divider,
    },
    sessionContent: {
        flex: 1,
        justifyContent: 'center',
    },
    statusDotRight: {
        marginLeft: 8,
    },
    sessionTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 3,
    },
    sessionTitle: {
        fontSize: 14,
        ...Typography.default('regular'),
        flex: 1,
    },
    sessionFolder: {
        fontSize: 12,
        color: theme.colors.textSecondary,
        ...Typography.default(),
        marginLeft: 8,
    },
    sessionFolderActive: {
        color: theme.colors.textLink,
    },
    sessionTitleConnected: {
        color: theme.colors.text,
    },
    sessionTitleDisconnected: {
        color: theme.colors.textSecondary,
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between'
    },
    statusDotContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        height: 16,
        marginTop: 2,
        marginRight: 4,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '500',
        lineHeight: 16,
        ...Typography.default(),
    },
    newSessionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: theme.colors.divider,
        backgroundColor: theme.colors.surface,
    },
    newSessionButtonDisabled: {
        opacity: 0.5,
    },
    newSessionButtonContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    newSessionButtonIcon: {
        marginRight: 6,
        width: 18,
        height: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    newSessionButtonText: {
        fontSize: 14,
        fontWeight: '500',
        color: theme.colors.text,
        ...Typography.default('semiBold'),
    },
    newSessionButtonTextDisabled: {
        color: theme.colors.textSecondary,
    },
    activityText: {
        fontSize: 12,
        color: theme.colors.textSecondary,
        marginBottom: 2,
        ...Typography.default(),
    },
    taskStatusContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.colors.surfaceHighest,
        paddingHorizontal: 4,
        height: 16,
        borderRadius: 4,
    },
    taskStatusText: {
        fontSize: 10,
        fontWeight: '500',
        color: theme.colors.textSecondary,
        ...Typography.default(),
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


export function ActiveSessionsGroup({ sessions, selectedSessionId }: ActiveSessionsGroupProps) {
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
            const machineId = session.metadata?.machineId || 'unknown';

            // Get machine info
            const machine = machineId !== 'unknown' ? machinesMap[machineId] : null;
            const machineName = machine?.metadata?.displayName ||
                machine?.metadata?.host ||
                (machineId !== 'unknown' ? machineId : '<unknown>');

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

        // Sort sessions within each machine group by last update time (newest first)
        groups.forEach(projectGroup => {
            projectGroup.machines.forEach(machineGroup => {
                machineGroup.sessions.sort((a, b) => b.updatedAt - a.updatedAt);
            });
        });

        return groups;
    }, [sessions, machinesMap]);

    // Sort project groups by most recent update (newest first)
    const sortedProjectGroups = React.useMemo(() => {
        const getGroupMaxUpdatedAt = (group: { machines: Map<string, { sessions: Session[] }> }) => {
            let max = 0;
            group.machines.forEach(machine => {
                machine.sessions.forEach(s => { if (s.updatedAt > max) max = s.updatedAt; });
            });
            return max;
        };
        return Array.from(projectGroups.entries()).sort(([, groupA], [, groupB]) => {
            return getGroupMaxUpdatedAt(groupB) - getGroupMaxUpdatedAt(groupA);
        });
    }, [projectGroups]);

    return (
        <View style={styles.container}>
            {sortedProjectGroups.map(([projectPath, projectGroup]) => {
                // Get the first machine name from this project's machines
                const firstMachine = Array.from(projectGroup.machines.values())[0];
                const machineName = projectGroup.machines.size === 1
                    ? firstMachine?.machineName
                    : `${projectGroup.machines.size} machines`;

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
    const activityText = getSessionActivityText(session);
    const navigateToSession = useNavigateToSession();
    const isTablet = useIsTablet();
    const swipeableRef = React.useRef<Swipeable | null>(null);
    const swipeEnabled = Platform.OS !== 'web';
    const pendingPermission = usePendingPermission(session);
    const [permissionLoading, setPermissionLoading] = React.useState<'allow' | 'allEdits' | 'deny' | null>(null);
    const isEditTool = pendingPermission && ['Edit', 'MultiEdit', 'Write', 'NotebookEdit', 'ExitPlanMode', 'exit_plan_mode'].includes(pendingPermission.toolName);

    // Split view state
    const addPanel = useSplitViewStore(state => state.addPanel);
    const hasPanel = useSplitViewStore(state => state.hasPanel);
    const isInSplitView = hasPanel(session.id);

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
            ]}
            onPressIn={() => {
                if (isTablet) {
                    addPanel(session.id);
                }
            }}
            onPress={() => {
                if (!isTablet) {
                    navigateToSession(session.id);
                }
            }}
        >
            <View style={styles.sessionContent}>
                <View style={styles.sessionTitleRow}>
                    <Text
                        style={[
                            styles.sessionTitle,
                            sessionStatus.isConnected ? styles.sessionTitleConnected : styles.sessionTitleDisconnected
                        ]}
                        numberOfLines={1}
                    >
                        {sessionName}
                    </Text>
                    {session.metadata?.path && (
                        <Text style={[
                            styles.sessionFolder,
                            isInSplitView && styles.sessionFolderActive
                        ]} numberOfLines={1}>
                            {session.metadata.path.split('/').pop()}
                        </Text>
                    )}
                    <View style={styles.statusDotRight}>
                        <StatusDot color={sessionStatus.statusDotColor} isPulsing={sessionStatus.isPulsing} />
                    </View>
                </View>
                {activityText && (
                    <Text style={styles.activityText} numberOfLines={1}>
                        {activityText}
                    </Text>
                )}
            </View>

        </Pressable>
        {pendingPermission && (
            <View style={styles.permissionRow}>
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
