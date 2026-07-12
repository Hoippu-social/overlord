import type {
    IntakeField,
    IntakeFieldType,
    TicketButtonStyle,
    TicketEntryPoint,
    TicketEntryPresentation,
    TicketGhostReply,
} from './types';

export type RawTicketItem = {
    id?: number;
    type?: string;
    label?: string;
    description?: string | null;
    emoji?: string | null;
    replyContent?: string | null;
    agentRoles?: string | null;
    requiredRoles?: string | null;
};

export type TicketItemPayload = {
    type: 'ENTRY' | 'REPLY';
    label: string;
    description: string | null;
    emoji: string | null;
    replyContent: string;
    agentRoles: string | null;
    requiredRoles: string | null;
};

type EntryConfig = {
    version: 1;
    kind: 'entry';
    presentation: TicketEntryPresentation;
    style: TicketButtonStyle;
    fields: IntakeField[];
};

type GhostConfig = {
    version: 1;
    kind: 'ghost';
    response: string;
};

const FIELD_TYPES = new Set<IntakeFieldType>(['short', 'paragraph', 'number', 'select']);
const ENTRY_PRESENTATIONS = new Set<TicketEntryPresentation>(['button', 'select', 'both']);
const BUTTON_STYLES = new Set<TicketButtonStyle>(['PRIMARY', 'SECONDARY', 'SUCCESS', 'DANGER']);

function record(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function parseJson(value?: string | null): Record<string, unknown> | null {
    if (!value?.trim()) return null;
    try { return record(JSON.parse(value)); } catch { return null; }
}

function normalizeFields(value: unknown): IntakeField[] {
    if (!Array.isArray(value)) return [];
    return value.slice(0, 5).map((item, index) => {
        const source = record(item) ?? {};
        const type = FIELD_TYPES.has(source.type as IntakeFieldType) ? source.type as IntakeFieldType : 'short';
        return {
            id: typeof source.id === 'string' ? source.id : `field-${index + 1}`,
            label: typeof source.label === 'string' ? source.label.slice(0, 45) : `Question ${index + 1}`,
            type,
            required: source.required !== false,
            options: type === 'select' && Array.isArray(source.options)
                ? source.options.filter((option): option is string => typeof option === 'string').slice(0, 25)
                : undefined,
        };
    });
}

function entryFromItem(item: RawTicketItem, index: number, fallbackFields: IntakeField[]): TicketEntryPoint | null {
    if (item.type !== 'ENTRY' && item.type !== 'DEPARTMENT' && item.type !== 'BUTTON') return null;
    const config = parseJson(item.replyContent);
    const presentation = ENTRY_PRESENTATIONS.has(config?.presentation as TicketEntryPresentation)
        ? config?.presentation as TicketEntryPresentation
        : item.type === 'BUTTON' ? 'button' : 'select';
    const style = BUTTON_STYLES.has(config?.style as TicketButtonStyle) ? config?.style as TicketButtonStyle : 'PRIMARY';
    const fields = normalizeFields(config?.fields);
    return {
        id: item.id ? `entry-${item.id}` : `entry-${index + 1}`,
        sourceId: item.id,
        label: (item.label || `Ticket option ${index + 1}`).slice(0, 80),
        description: item.description ?? null,
        emoji: item.emoji ?? null,
        style,
        presentation,
        fields: fields.length ? fields : fallbackFields,
    };
}

function ghostFromItem(item: RawTicketItem, index: number): TicketGhostReply | null {
    if (item.type !== 'REPLY') return null;
    const config = parseJson(item.replyContent);
    return {
        id: item.id ? `ghost-${item.id}` : `ghost-${index + 1}`,
        sourceId: item.id,
        label: (item.label || `Quick answer ${index + 1}`).slice(0, 100),
        description: item.description ?? null,
        emoji: item.emoji ?? null,
        response: config?.kind === 'ghost' && typeof config.response === 'string'
            ? config.response
            : item.replyContent || '',
    };
}

export function parseCategoryFlow(
    items: RawTicketItem[] | undefined,
    fallback: { label: string; emoji?: string | null; style?: string | null; fields: IntakeField[] },
): { entryPoints: TicketEntryPoint[]; ghostReplies: TicketGhostReply[] } {
    const source = Array.isArray(items) ? items : [];
    const entryPoints = source.map((item, index) => entryFromItem(item, index, fallback.fields)).filter((item): item is TicketEntryPoint => Boolean(item));
    const ghostReplies = source.map(ghostFromItem).filter((item): item is TicketGhostReply => Boolean(item));
    if (!entryPoints.length) {
        entryPoints.push({
            id: 'entry-primary',
            label: fallback.label || 'Create Ticket',
            emoji: fallback.emoji ?? null,
            style: BUTTON_STYLES.has(fallback.style as TicketButtonStyle) ? fallback.style as TicketButtonStyle : 'PRIMARY',
            presentation: 'button',
            fields: fallback.fields,
        });
    }
    return { entryPoints, ghostReplies };
}

export function serializeCategoryFlow(entryPoints: TicketEntryPoint[], ghostReplies: TicketGhostReply[]): TicketItemPayload[] {
    const entries = entryPoints.slice(0, 25).map((entry): TicketItemPayload => {
        const config: EntryConfig = {
            version: 1,
            kind: 'entry',
            presentation: entry.presentation,
            style: entry.style,
            fields: entry.fields.slice(0, 5),
        };
        return {
            type: 'ENTRY',
            label: entry.label.slice(0, 100),
            description: entry.description?.slice(0, 100) || null,
            emoji: entry.emoji || null,
            replyContent: JSON.stringify(config),
            agentRoles: null,
            requiredRoles: null,
        };
    });
    const replies = ghostReplies.slice(0, 24).map((reply): TicketItemPayload => {
        const config: GhostConfig = { version: 1, kind: 'ghost', response: reply.response.slice(0, 4000) };
        return {
            type: 'REPLY',
            label: reply.label.slice(0, 100),
            description: reply.description?.slice(0, 100) || null,
            emoji: reply.emoji || null,
            replyContent: JSON.stringify(config),
            agentRoles: null,
            requiredRoles: null,
        };
    });
    return [...entries, ...replies];
}
