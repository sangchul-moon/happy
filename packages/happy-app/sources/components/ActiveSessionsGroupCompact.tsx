import React from 'react';
import { View, Pressable, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Text } from '@/components/StyledText';
import { Machine } from '@/sync/storageTypes';
import { SessionRowData } from '@/sync/storage';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { type SessionState, formatPathRelativeToHome, vibingMessages, formatLastSeen } from '@/utils/sessionUtils';
import { Typography } from '@/constants/Typography';
import { StatusDot } from './StatusDot';
import { useAllMachines, useSessionGitStatus, useSession, storage } from '@/sync/storage';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { t } from '@/text';
import { useNavigateToSession } from '@/hooks/useNavigateToSession';
import { useHappyAction } from '@/hooks/useHappyAction';
import { HappyError } from '@/utils/errors';
import { SessionActionsAnchor, SessionActionsPopover } from './SessionActionsPopover';
import { useSessionActionAlert } from '@/hooks/useSessionQuickActions';
import { sessionKill, sessionAllow, sessionDeny } from '@/sync/ops';
import { isWorktreePath, getRepoPath, getWorktreeName } from '@/utils/worktree';
import { useNewSessionDraft } from '@/hooks/useNewSessionDraft';
import { useRouter } from 'expo-router';
import { useIsTablet } from '@/utils/responsive';
import { useSplitViewStore, isSplitViewSupported } from '@/hooks/useSplitView';

const STATUS_CONFIG: Record<SessionState, { color: string; dotColor: string; isPulsing: boolean; isConnected: boolean }> = {
    disconnected: { color: '#999', dotColor: '#999', isPulsing: false, isConnected: false },
    thinking: { color: '#007AFF', dotColor: '#007AFF', isPulsing: true, isConnected: true },
    waiting: { color: '#34C759', dotColor: '#34C759', isPulsing: false, isConnected: true },
    permission_required: { color: '#FF9500', dotColor: '#FF9500', isPulsing: true, isConnected: true },
};

interface ActiveSessionsGroupProps {
    sessions: SessionRowData[];
    selectedSessionId?: string;
}

/**
 * Hook to get git display info for a section header:
 * branch name, line changes, and worktree status.
 */
function useSectionGitInfo(sessionId: string) {
    const gitStatus = useSessionGitStatus(sessionId);

    return React.useMemo(() => {
        if (!gitStatus || gitStatus.lastUpdatedAt === 0) {
            return { branch: null, linesAdded: 0, linesRemoved: 0, hasChanges: false };
        }
        return {
            branch: gitStatus.branch,
            linesAdded: gitStatus.unstagedLinesAdded,
            linesRemoved: gitStatus.unstagedLinesRemoved,
            hasChanges: gitStatus.unstagedLinesAdded > 0 || gitStatus.unstagedLinesRemoved > 0,
        };
    }, [gitStatus]);
}

// Section header: avatar | path + branch + tree icon + line changes | + button
const SectionHeader = React.memo(({ session, displayPath }: { session: SessionRowData; displayPath: string }) => {
    const styles = stylesheet;
    const { theme } = useUnistyles();
    const router = useRouter();
    const draft = useNewSessionDraft();

    const sessionPath = session.path || '';
    const isWorktree = isWorktreePath(sessionPath);
    const repoPath = isWorktree ? getRepoPath(sessionPath) : sessionPath;
    const repoDisplayPath = isWorktree
        ? formatPathRelativeToHome(repoPath, session.homeDir ?? undefined)
        : displayPath;
    const repoFolderName = repoPath.split(/[/\\]/).filter(Boolean).pop() || repoDisplayPath;
    const worktreeName = isWorktree ? getWorktreeName(sessionPath) : null;

    const gitInfo = useSectionGitInfo(session.id);
    const branchName = worktreeName || gitInfo.branch;
    const hasBranch = !!branchName;

    const handleAdd = React.useCallback(() => {
        const machineId = session.machineId;
        if (machineId) {
            draft.setMachineId(machineId);
        }
        const pathToSet = formatPathRelativeToHome(repoPath, session.homeDir ?? undefined);
        draft.setPath(pathToSet);
        draft.setSessionType(isWorktree ? 'worktree' : 'simple');
        draft.setWorktreeKey(isWorktree ? sessionPath : null);
        router.navigate('/new');
    }, [session.machineId, session.homeDir, repoPath, isWorktree, sessionPath, draft, router]);

    const [isHovered, setIsHovered] = React.useState(false);

    return (
        <View
            style={hasBranch ? styles.sectionHeader : styles.sectionHeaderSingleLine}
            // @ts-ignore - Web only events
            onMouseEnter={() => setIsHovered(true)}
            // @ts-ignore - Web only events
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Path + branch */}
            <View style={styles.sectionHeaderContent}>
                <Text style={styles.sectionHeaderPath} numberOfLines={1}>
                    {repoFolderName}
                </Text>
                {hasBranch && (
                    <View style={styles.branchRow}>
                        <Text style={styles.branchText} numberOfLines={1}>
                            {branchName}
                        </Text>
                        {isWorktree && (
                            <MaterialCommunityIcons
                                name="tree"
                                size={11}
                                color={theme.colors.textSecondary}
                                style={styles.worktreeIcon}
                            />
                        )}
                        {gitInfo.linesAdded > 0 && (
                            <Text style={styles.addedText}>+{gitInfo.linesAdded}</Text>
                        )}
                        {gitInfo.linesRemoved > 0 && (
                            <Text style={styles.removedText}>-{gitInfo.linesRemoved}</Text>
                        )}
                    </View>
                )}
            </View>

            {/* + button — vertically centered, large hit area; desktop: hover-only */}
            <Pressable
                onPress={handleAdd}
                hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                style={[styles.addButton, { opacity: Platform.OS !== 'web' || isHovered ? 1 : 0 }]}
            >
                <Ionicons name="add-outline" size={14} color={theme.colors.textSecondary} />
            </Pressable>
        </View>
    );
});

// Full-width separator between machine groups: ——— 🖥 name ———
const MachineSeparator = React.memo(({ machineName, machineId }: { machineName: string; machineId: string }) => {
    const styles = stylesheet;
    const { theme } = useUnistyles();
    const router = useRouter();

    const handlePress = React.useCallback(() => {
        router.navigate(`/machine/${machineId}` as any);
    }, [router, machineId]);

    return (
        <Pressable onPress={handlePress} style={styles.machineSeparator} hitSlop={{ top: 8, bottom: 8 }}>
            <View style={styles.machineSeparatorLine} />
            <Ionicons name="desktop-outline" size={11} color={theme.colors.textSecondary} style={{ marginHorizontal: 6 }} />
            <Text style={styles.machineSeparatorText} numberOfLines={1}>
                {machineName}
            </Text>
            <View style={styles.machineSeparatorLine} />
        </Pressable>
    );
});

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

    // Group sessions by machine, then by project within each machine
    const { machineGroups, hasMultipleMachines } = React.useMemo(() => {
        const unknownText = t('status.unknown');
        const byMachine = new Map<string, {
            machineId: string;
            machineName: string;
            projects: Map<string, {
                displayPath: string;
                sessions: SessionRowData[];
            }>;
        }>();

        sessions.forEach(session => {
            const machineId = session.machineId || unknownText;
            const machine = machineId !== unknownText ? machinesMap[machineId] : null;
            const machineName = machine?.metadata?.displayName ||
                machine?.metadata?.host ||
                (machineId !== unknownText ? machineId : `<${unknownText}>`);

            let machineGroup = byMachine.get(machineId);
            if (!machineGroup) {
                machineGroup = { machineId, machineName, projects: new Map() };
                byMachine.set(machineId, machineGroup);
            }

            const projectPath = session.path || '';
            let projectGroup = machineGroup.projects.get(projectPath);
            if (!projectGroup) {
                const displayPath = formatPathRelativeToHome(projectPath, session.homeDir ?? undefined);
                projectGroup = { displayPath, sessions: [] };
                machineGroup.projects.set(projectPath, projectGroup);
            }

            projectGroup.sessions.push(session);
        });

        // Sort sessions within each project group
        byMachine.forEach(mg => {
            mg.projects.forEach(pg => {
                pg.sessions.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
            });
        });

        const sorted = Array.from(byMachine.values()).sort((a, b) =>
            a.machineName.localeCompare(b.machineName)
        );

        return { machineGroups: sorted, hasMultipleMachines: byMachine.size > 1 };
    }, [sessions, machinesMap]);

    return (
        <View style={styles.container}>
            {machineGroups.map(machineGroup => {
                const sortedProjects = Array.from(machineGroup.projects.entries()).sort(
                    ([, a], [, b]) => a.displayPath.localeCompare(b.displayPath)
                );

                return (
                    <React.Fragment key={machineGroup.machineId}>
                        {hasMultipleMachines && (
                            <MachineSeparator
                                machineName={machineGroup.machineName}
                                machineId={machineGroup.machineId}
                            />
                        )}
                        {sortedProjects.map(([projectPath, projectGroup]) => {
                            const firstSession = projectGroup.sessions[0];
                            if (!firstSession) return null;

                            return (
                                <View key={projectPath}>
                                    <SectionHeader
                                        session={firstSession}
                                        displayPath={projectGroup.displayPath}
                                    />
                                    <View style={styles.projectCard}>
                                        {projectGroup.sessions.map((session, index) => (
                                            <CompactSessionRow
                                                key={session.id}
                                                session={session}
                                                selected={selectedSessionId === session.id}
                                                showBorder={index < projectGroup.sessions.length - 1}
                                            />
                                        ))}
                                    </View>
                                </View>
                            );
                        })}
                    </React.Fragment>
                );
            })}
        </View>
    );
}

// Tools whose pending permission can be answered with "accept all edits"
const EDIT_TOOLS = ['Edit', 'MultiEdit', 'Write', 'NotebookEdit', 'ExitPlanMode', 'exit_plan_mode'];

// Inline Allow / All Edits (or Always) / Deny buttons shown under a session row
// while the agent waits on a tool permission. Subscribes to the full session
// only when mounted (rows mount it only in the permission_required state), so
// the SessionRowData deep-equal optimization stays intact.
const PermissionActions = React.memo(({ sessionId }: { sessionId: string }) => {
    const styles = stylesheet;
    const { theme } = useUnistyles();
    const session = useSession(sessionId);
    const [loading, setLoading] = React.useState<'allow' | 'allEdits' | 'deny' | null>(null);

    const pending = React.useMemo(() => {
        const requests = session?.agentState?.requests;
        if (!requests) return null;
        const ids = Object.keys(requests);
        if (ids.length === 0) return null;
        const id = ids[0];
        return { id, toolName: requests[id].tool, input: requests[id].arguments as Record<string, any> | undefined };
    }, [session?.agentState?.requests]);

    if (!pending) return null;

    const isEditTool = EDIT_TOOLS.includes(pending.toolName);
    const detail = pending.input?.file_path ? `: ${String(pending.input.file_path).split('/').pop()}`
        : pending.input?.command ? `: ${pending.input.command}`
            : pending.input?.pattern ? `: ${pending.input.pattern}`
                : '';

    const run = (kind: 'allow' | 'allEdits' | 'deny', fn: () => Promise<void>) => async () => {
        if (loading) return;
        setLoading(kind);
        try {
            await fn();
        } finally {
            setLoading(null);
        }
    };

    return (
        <View style={styles.permissionRow}>
            <Text style={styles.permissionToolName} numberOfLines={1}>
                {pending.toolName}{detail}
            </Text>
            <TouchableOpacity
                activeOpacity={0.7}
                style={[styles.permissionButton, styles.permissionAllowButton]}
                onPress={run('allow', () => sessionAllow(sessionId, pending.id))}
                disabled={loading !== null}
            >
                {loading === 'allow' ? (
                    <ActivityIndicator size="small" color={theme.colors.status.connected} />
                ) : (
                    <Text style={[styles.permissionButtonText, styles.permissionAllowText]}>Allow</Text>
                )}
            </TouchableOpacity>
            <TouchableOpacity
                activeOpacity={0.7}
                style={[styles.permissionButton, styles.permissionAllEditsButton]}
                onPress={run('allEdits', async () => {
                    if (isEditTool) {
                        await sessionAllow(sessionId, pending.id, 'acceptEdits');
                        storage.getState().updateSessionPermissionMode(sessionId, 'acceptEdits');
                    } else {
                        let toolIdentifier = pending.toolName;
                        if (pending.toolName === 'Bash' && pending.input?.command) {
                            toolIdentifier = `Bash(${pending.input.command})`;
                        }
                        await sessionAllow(sessionId, pending.id, undefined, [toolIdentifier]);
                    }
                })}
                disabled={loading !== null}
            >
                {loading === 'allEdits' ? (
                    <ActivityIndicator size="small" color={theme.colors.textLink} />
                ) : (
                    <Text style={[styles.permissionButtonText, styles.permissionAllEditsText]}>
                        {isEditTool ? 'All Edits' : 'Always'}
                    </Text>
                )}
            </TouchableOpacity>
            <TouchableOpacity
                activeOpacity={0.7}
                style={[styles.permissionButton, styles.permissionDenyButton]}
                onPress={run('deny', () => sessionDeny(sessionId, pending.id))}
                disabled={loading !== null}
            >
                {loading === 'deny' ? (
                    <ActivityIndicator size="small" color={theme.colors.status.error} />
                ) : (
                    <Text style={[styles.permissionButtonText, styles.permissionDenyText]}>Deny</Text>
                )}
            </TouchableOpacity>
        </View>
    );
});

// Compact session row with status dot indicator
const CompactSessionRow = React.memo(({ session, selected, showBorder }: { session: SessionRowData; selected?: boolean; showBorder?: boolean }) => {
    const styles = stylesheet;
    const { theme } = useUnistyles();
    const baseStatus = STATUS_CONFIG[session.state];
    // Override to solid blue when session has unread results
    const status = session.hasUnread
        ? { ...baseStatus, color: '#007AFF', dotColor: '#007AFF', isPulsing: false, isConnected: baseStatus.isConnected }
        : baseStatus;
    const navigateToSession = useNavigateToSession();
    const router = useRouter();
    const isTablet = useIsTablet();
    const addPanel = useSplitViewStore(state => state.addPanel);
    const swipeableRef = React.useRef<Swipeable | null>(null);
    const swipeEnabled = Platform.OS !== 'web';
    const [actionsAnchor, setActionsAnchor] = React.useState<SessionActionsAnchor | null>(null);

    const [archivingSession, performArchive] = useHappyAction(async () => {
        const result = await sessionKill(session.id);
        if (!result.success) {
            throw new HappyError(result.message || t('sessionInfo.failedToArchiveSession'), false);
        }
    });

    const handleArchive = React.useCallback(() => {
        swipeableRef.current?.close();
        performArchive();
    }, [performArchive]);

    const handlePress = React.useCallback(() => {
        // On web/desktop tablets, clicking a session adds it as a split-view panel
        // (up to maxPanels) and keeps us on the index route where panels render.
        if (isTablet && isSplitViewSupported()) {
            addPanel(session.id);
            router.navigate('/');
            return;
        }
        navigateToSession(session.id);
    }, [isTablet, addPanel, router, navigateToSession, session.id]);

    const handleContextMenu = React.useCallback((event: any) => {
        event.preventDefault?.();
        event.stopPropagation?.();
        setActionsAnchor({
            type: 'point',
            x: event.nativeEvent.clientX ?? event.nativeEvent.pageX ?? 0,
            y: event.nativeEvent.clientY ?? event.nativeEvent.pageY ?? 0,
        });
    }, []);

    const showActionAlert = useSessionActionAlert(session.id);
    const menuProps = Platform.OS === 'web' ? {
        onContextMenu: handleContextMenu,
    } as any : {
        onLongPress: showActionAlert,
    };

    const renderLeadingIndicator = () => {
        let indicator: React.ReactNode = null;

        if (session.hasUnread) {
            indicator = <StatusDot color={status.dotColor} isPulsing={false} />;
        } else if (session.state === 'waiting' && session.hasDraft) {
            indicator = (
                <Ionicons
                    name="create-outline"
                    size={14}
                    color={theme.colors.textSecondary}
                />
            );
        } else if (session.state === 'permission_required' || session.state === 'thinking') {
            indicator = <StatusDot color={status.dotColor} isPulsing={status.isPulsing} />;
        } else if (session.state === 'waiting') {
            indicator = <StatusDot color={theme.colors.textSecondary} isPulsing={false} />;
        }

        return (
            <View style={styles.leadingIndicatorSlot}>
                {indicator}
            </View>
        );
    };

    const itemContent = (
        <Pressable
            style={[
                styles.sessionRow,
                showBorder && session.state !== 'permission_required' && styles.sessionRowWithBorder,
                selected && styles.sessionRowSelected
            ]}
            onPress={handlePress}
            {...menuProps}
        >
            <View style={styles.sessionContent}>
                <View style={styles.sessionTitleRow}>
                    {renderLeadingIndicator()}

                    <Text
                        style={[
                            styles.sessionTitle,
                            status.isConnected ? styles.sessionTitleConnected : styles.sessionTitleDisconnected
                        ]}
                        numberOfLines={2}
                    >
                        {session.name}
                    </Text>
                </View>
                {session.lastActivity && (
                    <Text style={styles.lastActivityText} numberOfLines={2}>
                        {session.lastActivity}
                    </Text>
                )}
            </View>
        </Pressable>
    );

    const itemWithPermission = (
        <View>
            {itemContent}
            {session.state === 'permission_required' && (
                <PermissionActions sessionId={session.id} />
            )}
        </View>
    );

    if (!swipeEnabled) {
        return (
            <>
                {itemWithPermission}
                <SessionActionsPopover
                    anchor={actionsAnchor}
                    onClose={() => setActionsAnchor(null)}
                    sessionId={session.id}
                    visible={!!actionsAnchor}
                />
            </>
        );
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
            {itemWithPermission}
        </Swipeable>
    );
});

function hexToRgba(hex: string, alpha: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const stylesheet = StyleSheet.create((theme) => ({
    container: {
        backgroundColor: theme.colors.groupped.background,
        paddingTop: 8,
    },
    // Inline permission action row (Allow / All Edits / Deny)
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
    // Section header styles
    sectionHeader: {
        paddingTop: 12,
        paddingBottom: Platform.select({ ios: 6, default: 8 }),
        paddingHorizontal: Platform.select({ ios: 32, default: 24 }),
        flexDirection: 'row',
        alignItems: 'center',
    },
    sectionHeaderSingleLine: {
        paddingTop: 12,
        paddingBottom: Platform.select({ ios: 6, default: 8 }),
        paddingHorizontal: Platform.select({ ios: 32, default: 24 }),
        flexDirection: 'row',
        alignItems: 'center',
    },
    sectionHeaderContent: {
        flex: 1,
        justifyContent: 'center',
        minWidth: 0,
    },
    sectionHeaderPath: {
        ...Typography.default('regular'),
        color: theme.colors.groupped.sectionTitle,
        fontSize: Platform.select({ ios: 13, default: 14 }),
        lineHeight: Platform.select({ ios: 18, default: 20 }),
        letterSpacing: Platform.select({ ios: -0.08, default: 0.1 }),
        fontWeight: Platform.select({ ios: 'normal', default: '500' }),
        flexShrink: 1,
    },
    branchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 1,
    },
    branchText: {
        fontSize: 11,
        color: theme.colors.textSecondary,
        ...Typography.default('regular'),
        flexShrink: 1,
    },
    worktreeIcon: {
        marginLeft: 4,
    },
    addedText: {
        fontSize: 11,
        fontWeight: '600',
        color: theme.colors.gitAddedText,
        marginLeft: 6,
    },
    removedText: {
        fontSize: 11,
        fontWeight: '600',
        color: theme.colors.gitRemovedText,
        marginLeft: 3,
    },
    addButton: {
        marginLeft: 4,
        padding: 8,
    },
    // Machine separator styles
    machineSeparator: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Platform.select({ ios: 32, default: 24 }),
        paddingTop: 8,
        paddingBottom: 0,
    },
    machineSeparatorLine: {
        flex: 1,
        height: StyleSheet.hairlineWidth,
        backgroundColor: theme.colors.divider,
    },
    machineSeparatorText: {
        fontSize: 11,
        color: theme.colors.textSecondary,
        ...Typography.default('regular'),
        marginRight: 4,
    },
    // Project card styles
    projectCard: {
        backgroundColor: theme.colors.surface,
        marginBottom: 8,
        marginHorizontal: Platform.select({ ios: 16, default: 12 }),
        borderRadius: Platform.select({ ios: 10, default: 16 }),
        overflow: 'hidden',
        shadowColor: theme.colors.shadow.color,
        shadowOffset: { width: 0, height: 0.33 },
        shadowOpacity: theme.colors.shadow.opacity,
        shadowRadius: 0,
        elevation: 1,
    },
    // Session row styles
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
    lastActivityText: {
        fontSize: 12,
        color: theme.colors.textSecondary,
        opacity: 0.7,
        marginTop: 2,
        ...Typography.default(),
    },
    leadingIndicatorSlot: {
        alignItems: 'center',
        justifyContent: 'center',
        width: 16,
        height: 16,
        marginRight: 8,
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
}));
