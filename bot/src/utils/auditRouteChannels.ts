export function parseAuditRouteChannelIds(value: string | null | undefined): string[] {
    if (!value) return [];

    const trimmed = value.trim();
    if (!trimmed) return [];

    if (trimmed.startsWith('[')) {
        try {
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed)) {
                return Array.from(
                    new Set(
                        parsed
                            .filter((entry): entry is string => typeof entry === 'string')
                            .map((entry) => entry.trim())
                            .filter(Boolean)
                    )
                );
            }
        } catch {
            return [];
        }
    }

    return [trimmed];
}

export function serializeAuditRouteChannelIds(channelIds: string[]): string {
    const uniqueChannelIds = Array.from(
        new Set(channelIds.map((channelId) => channelId.trim()).filter(Boolean))
    );

    if (uniqueChannelIds.length === 0) {
        return '';
    }

    if (uniqueChannelIds.length === 1) {
        return uniqueChannelIds[0];
    }

    return JSON.stringify(uniqueChannelIds);
}
