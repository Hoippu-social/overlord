export type ChannelSelectItem = {
    id: string;
    name?: string | null;
    type?: number | string | null;
    position?: number | null;
    parentId?: string | null;
    isCategory?: boolean;
    categoryName?: string | null;
};

type BuildChannelSelectOptionsArgs = {
    channels: ChannelSelectItem[];
    categories?: ChannelSelectItem[];
    includeCategories?: boolean;
};

const normalizeChannel = (channel: ChannelSelectItem): ChannelSelectItem => ({
    ...channel,
    id: String(channel.id),
    name: channel.name || String(channel.id),
    parentId: channel.parentId ? String(channel.parentId) : null,
});

export function buildChannelSelectOptions({
    channels,
    categories = [],
    includeCategories = false,
}: BuildChannelSelectOptionsArgs): ChannelSelectItem[] {
    const normalizedCategories = categories.map((category) => ({
        ...normalizeChannel(category),
        isCategory: true,
        categoryName: null,
    }));

    const categoryNameMap = new Map(
        normalizedCategories.map((category) => [category.id, category.name || category.id]),
    );

    const normalizedChannels = channels.map((channel) => {
        const normalized = normalizeChannel(channel);
        return {
            ...normalized,
            isCategory: Boolean(normalized.isCategory),
            categoryName: normalized.isCategory
                ? null
                : normalized.parentId
                    ? (categoryNameMap.get(normalized.parentId) ?? normalized.categoryName ?? null)
                    : (normalized.categoryName ?? null),
        };
    });

    if (!includeCategories || normalizedCategories.length === 0) {
        return normalizedChannels;
    }

    const grouped = new Map<string, ChannelSelectItem[]>();
    const ungrouped: ChannelSelectItem[] = [];

    for (const channel of normalizedChannels) {
        if (channel.isCategory) {
            continue;
        }

        if (channel.parentId && categoryNameMap.has(channel.parentId)) {
            const bucket = grouped.get(channel.parentId) ?? [];
            bucket.push(channel);
            grouped.set(channel.parentId, bucket);
            continue;
        }

        ungrouped.push(channel);
    }

    const result: ChannelSelectItem[] = [...ungrouped];

    for (const category of normalizedCategories) {
        result.push(category);
        const children = grouped.get(category.id) ?? [];
        result.push(...children);
    }

    return result;
}
