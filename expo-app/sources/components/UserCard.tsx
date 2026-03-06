import React from 'react';
import { UserProfile, getDisplayName } from '@/sync/friendTypes';
import { Item } from '@/components/Item';
interface UserCardProps {
    user: UserProfile;
    onPress?: () => void;
}

export function UserCard({
    user,
    onPress
}: UserCardProps) {
    const displayName = getDisplayName(user);

    // Create subtitle
    const subtitle = `@${user.username}`;

    return (
        <Item
            title={displayName}
            subtitle={subtitle}
            subtitleLines={1}
            onPress={onPress}
            showChevron={!!onPress}
        />
    );
}