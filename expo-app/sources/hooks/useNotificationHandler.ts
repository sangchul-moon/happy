/**
 * Notification response handler hook
 *
 * Handles notification scenarios:
 * 1. Tap on any push → navigate to the relevant session
 * 2. iOS "Approve" action on permission_request → approve via RPC
 * 3. iOS "Deny" action on permission_request → deny via RPC
 * 4. iOS "Reply" text input → send message to the session
 */

import * as React from 'react';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { sessionAllow, sessionDeny } from '@/sync/ops';
import { sync } from '@/sync/sync';
import { log } from '@/log';

const REPLY_ACTION: Notifications.NotificationAction = {
    identifier: 'reply',
    buttonTitle: 'Reply',
    textInput: { submitButtonTitle: 'Send', placeholder: 'Message...' },
    options: { opensAppToForeground: false },
};

/** Register iOS/Android notification categories with action buttons */
export async function registerNotificationCategories(): Promise<void> {
    if (Platform.OS === 'web') return;

    try {
        await Notifications.setNotificationCategoryAsync('permission_request', [
            {
                identifier: 'approve',
                buttonTitle: 'Approve',
                options: { opensAppToForeground: false },
            },
            {
                identifier: 'deny',
                buttonTitle: 'Deny',
                options: { isDestructive: true, opensAppToForeground: false },
            },
            REPLY_ACTION,
        ]);

        await Notifications.setNotificationCategoryAsync('ready', [
            REPLY_ACTION,
        ]);

        // Verify registration
        const categories = await Notifications.getNotificationCategoriesAsync();
        log.log(`[notification] Registered ${categories.length} categories: ${categories.map(c => c.identifier).join(', ')}`);
    } catch (e) {
        log.error('[notification] Failed to register categories:', e);
    }
}

/**
 * Listens for notification taps and action button presses.
 * Must be called inside a component with access to expo-router.
 */
export function useNotificationHandler(): void {
    const router = useRouter();

    React.useEffect(() => {
        if (Platform.OS === 'web') return;

        const subscription = Notifications.addNotificationResponseReceivedListener(async (response) => {
            const data = response.notification.request.content.data as Record<string, unknown> | undefined;
            const actionId = response.actionIdentifier;
            const sessionId = data?.sessionId as string | undefined;
            const requestId = data?.requestId as string | undefined;
            const pushType = data?.type as string | undefined;
            const userText = response.userText;

            log.log(`[notification] action=${actionId}, type=${pushType}, session=${sessionId}, request=${requestId}, text=${userText}`);

            // Handle reply text input
            if (actionId === 'reply' && sessionId && userText) {
                try {
                    if (pushType === 'permission_request' && requestId) {
                        // Reply on permission_request → deny with feedback (like "No, and provide feedback")
                        await sessionDeny(sessionId, requestId, undefined, undefined, undefined, userText);
                        log.log(`[notification] Permission denied with feedback: ${requestId} → ${userText}`);
                    } else {
                        // Reply on ready → send as message
                        await sync.sendMessage(sessionId, userText);
                        log.log(`[notification] Reply sent to session ${sessionId}: ${userText}`);
                    }
                } catch (e) {
                    log.error('[notification] Failed to handle reply:', e);
                }
                return;
            }

            // Handle permission action buttons (background actions)
            if (pushType === 'permission_request' && sessionId && requestId) {
                if (actionId === 'approve') {
                    try {
                        await sessionAllow(sessionId, requestId);
                        log.log(`[notification] Permission approved: ${requestId}`);
                    } catch (e) {
                        log.error('[notification] Failed to approve permission:', e);
                    }
                    return;
                }
                if (actionId === 'deny') {
                    try {
                        await sessionDeny(sessionId, requestId);
                        log.log(`[notification] Permission denied: ${requestId}`);
                    } catch (e) {
                        log.error('[notification] Failed to deny permission:', e);
                    }
                    return;
                }
            }

            // Default tap → navigate to session
            if (sessionId && actionId === Notifications.DEFAULT_ACTION_IDENTIFIER) {
                router.navigate(`/session/${sessionId}`, {
                    dangerouslySingular(name, params) {
                        return 'session';
                    },
                });
            }
        });

        return () => subscription.remove();
    }, [router]);
}
