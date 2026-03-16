import axios from 'axios'
import path from 'path'
import { logger } from '@/ui/logger'
import { Expo, ExpoPushMessage } from 'expo-server-sdk'

export interface PushToken {
    id: string
    token: string
    createdAt: number
    updatedAt: number
}

/** Push notification types for iOS notification categories */
export type PushType = 'ready' | 'permission_request' | 'general'


export class PushNotificationClient {
    private readonly token: string
    private readonly baseUrl: string
    private readonly expo: Expo

    constructor(token: string, baseUrl: string = 'https://api.cluster-fluster.com') {
        this.token = token
        this.baseUrl = baseUrl
        this.expo = new Expo()
    }

    /**
     * Fetch all push tokens for the authenticated user
     */
    async fetchPushTokens(): Promise<PushToken[]> {
        try {
            const response = await axios.get<{ tokens: PushToken[] }>(
                `${this.baseUrl}/v1/push-tokens`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.token}`,
                        'Content-Type': 'application/json'
                    }
                }
            )

            logger.debug(`Fetched ${response.data.tokens.length} push tokens`)
            
            // Log token information
            response.data.tokens.forEach((token, index) => {
                logger.debug(`[PUSH] Token ${index + 1}: id=${token.id}, created=${new Date(token.createdAt).toISOString()}, updated=${new Date(token.updatedAt).toISOString()}`)
            })
            
            return response.data.tokens
        } catch (error) {
            logger.debug('[PUSH] [ERROR] Failed to fetch push tokens:', error)
            throw new Error(`Failed to fetch push tokens: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
    }

    /**
     * Send push notification via Expo Push API with retry
     * @param messages - Array of push messages to send
     */
    async sendPushNotifications(messages: ExpoPushMessage[]): Promise<void> {
        logger.debug(`Sending ${messages.length} push notifications`)

        // Filter out invalid push tokens
        const validMessages = messages.filter(message => {
            if (Array.isArray(message.to)) {
                return message.to.every(token => Expo.isExpoPushToken(token))
            }
            return Expo.isExpoPushToken(message.to)
        })

        if (validMessages.length === 0) {
            logger.debug('No valid Expo push tokens found')
            return
        }

        // Send each message individually to avoid cross-project token conflicts
        for (const message of validMessages) {
            try {
                const ticketChunk = await this.expo.sendPushNotificationsAsync([message])
                const ticket = ticketChunk[0]
                if (ticket.status === 'error') {
                    logger.debug(`[PUSH] Notification failed for token: ${JSON.stringify({ message: ticket.message, details: ticket.details })}`)
                }
            } catch (error) {
                logger.debug('[PUSH] Send error:', error instanceof Error ? error.message : error)
            }
        }

        logger.debug(`Push notifications sent successfully`)
    }

    /**
     * Send a push notification to all registered devices for the user
     * @param title - Notification title
     * @param body - Notification body
     * @param data - Additional data to send with the notification
     */
    sendToAllDevices(title: string, body: string, data?: Record<string, any>): void {
        this.sendToAllDevicesAsync(title, body, data).catch(() => {})
    }

    async sendToAllDevicesAsync(title: string, body: string, data?: Record<string, any>): Promise<void> {
        logger.debug(`[PUSH] sendToAllDevices called with title: "${title}", body: "${body}"`);

        try {
            // Fetch all push tokens
            logger.debug('[PUSH] Fetching push tokens...')
            const tokens = await this.fetchPushTokens()
            logger.debug(`[PUSH] Fetched ${tokens.length} push tokens`)

            // Log token details for debugging
            tokens.forEach((token, index) => {
                logger.debug(`[PUSH] Using token ${index + 1}: id=${token.id}`)
            })

            if (tokens.length === 0) {
                logger.debug('No push tokens found for user')
                return
            }

            // Resolve iOS notification category from push type (matches categories registered in the app)
            const pushType = data?.type as PushType | undefined
            const categoryId = (pushType === 'permission_request' || pushType === 'ready') ? pushType : undefined

            logger.debug(`[PUSH] pushType=${pushType}, categoryId=${categoryId}`)

            // Create messages for all tokens
            const messages: ExpoPushMessage[] = tokens.map((token, index) => {
                logger.debug(`[PUSH] Creating message ${index + 1} for token`)
                return {
                    to: token.token,
                    title,
                    body,
                    data,
                    sound: 'default',
                    priority: 'high',
                    ...(categoryId && { categoryId })
                }
            })

            // Send notifications
            logger.debug(`[PUSH] Sending ${messages.length} push notifications...`)
            await this.sendPushNotifications(messages)
            logger.debug('[PUSH] Push notifications sent successfully')
        } catch (error) {
            logger.debug('[PUSH] Error sending to all devices:', error)
        }
    }

    /**
     * Extract a short project name from a working directory path.
     * e.g. /Users/user/Projects/my-app → my-app
     */
    static projectName(cwd: string): string {
        return path.basename(cwd)
    }

    /**
     * Extract a human-readable detail string from permission tool input.
     * Shows file paths for file ops, commands for bash, etc.
     */
    static permissionDetail(toolName: string, input: unknown): string | null {
        if (!input || typeof input !== 'object') return null
        const obj = input as Record<string, unknown>

        // File operations - show the file path (basename only for brevity)
        if (['Read', 'Write', 'Edit', 'MultiEdit', 'NotebookEdit'].includes(toolName)) {
            const filePath = (obj.file_path || obj.filePath || obj.path) as string | undefined
            return filePath ? path.basename(filePath) : null
        }

        // Bash - show the command (truncated)
        if (toolName === 'Bash') {
            const cmd = (obj.command || obj.cmd) as string | undefined
            if (!cmd) return null
            const firstLine = cmd.split('\n')[0]
            return firstLine.length > 60 ? firstLine.substring(0, 57) + '...' : firstLine
        }

        // Web tools
        if (toolName === 'WebFetch') return (obj.url as string) || null
        if (toolName === 'WebSearch') return (obj.query as string) || null

        // Search tools
        if (['Glob', 'Grep'].includes(toolName)) {
            return (obj.pattern as string) || null
        }

        return null
    }
}
