export const COMPONENTS_V2_FLAG = 1 << 15;
export const TICKET_PANEL_DESIGN_VERSION = 1;

export type TicketPanelMode = 'classic_embed' | 'components_v2';
export type TicketButtonStyle = 'PRIMARY' | 'SECONDARY' | 'SUCCESS' | 'DANGER';

export type TicketPanelOpener = {
    label: string;
    emoji?: string | null;
    style: TicketButtonStyle;
};

export type APIEmbed = {
    title?: string;
    description?: string;
    url?: string;
    color?: number;
    timestamp?: string;
    footer?: { text: string; icon_url?: string };
    image?: { url: string };
    thumbnail?: { url: string };
    author?: { name: string; url?: string; icon_url?: string };
    fields?: Array<{ name: string; value: string; inline?: boolean }>;
};

export type V2MediaItem = {
    media: { url: string };
    description?: string;
    spoiler?: boolean;
};

export type V2TextDisplay = {
    id?: number | string;
    type: 10;
    content: string;
};

export type V2Thumbnail = {
    id?: number | string;
    type: 11;
    media: { url: string };
    description?: string;
    spoiler?: boolean;
};

export type V2MediaGallery = {
    id?: number | string;
    type: 12;
    items: V2MediaItem[];
};

export type V2Separator = {
    id?: number | string;
    type: 14;
    divider?: boolean;
    spacing?: 1 | 2;
};

export type V2LinkButton = {
    id?: number | string;
    type: 2;
    style: 5;
    label?: string;
    emoji?: { id?: string | null; name?: string | null; animated?: boolean } | string | null;
    url: string;
    disabled?: boolean;
};

export type V2ActionRow = {
    id?: number | string;
    type: 1;
    components: V2LinkButton[];
};

export type V2Section = {
    id?: number | string;
    type: 9;
    components: V2TextDisplay[];
    accessory?: V2Thumbnail | V2LinkButton;
};

export type V2Container = {
    id?: number | string;
    type: 17;
    components: Array<V2ActionRow | V2TextDisplay | V2Section | V2MediaGallery | V2Separator>;
    accent_color?: number;
    spoiler?: boolean;
};

export type V2TopLevelComponent =
    | V2ActionRow
    | V2TextDisplay
    | V2Section
    | V2MediaGallery
    | V2Separator
    | V2Container;

export type TicketPanelMessageDesign =
    | {
        version: 1;
        mode: 'classic_embed';
        opener: TicketPanelOpener;
        content: string;
        embeds: APIEmbed[];
    }
    | {
        version: 1;
        mode: 'components_v2';
        opener: TicketPanelOpener;
        flags: typeof COMPONENTS_V2_FLAG;
        components: V2TopLevelComponent[];
    };

export type TicketPanelLegacySource = {
    name?: string | null;
    messageText?: string | null;
    messageEmbeds?: string | null;
    buttonText?: string | null;
    buttonEmoji?: string | null;
    buttonStyle?: string | null;
};

export type TicketPanelLegacyFields = {
    messageText: string | null;
    messageEmbeds: string;
    buttonText: string;
    buttonEmoji: string | null;
    buttonStyle: TicketButtonStyle;
};

const DEFAULT_COLOR = 7729514;

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asString(value: unknown, fallback = '') {
    return typeof value === 'string' ? value : fallback;
}

function asOptionalString(value: unknown) {
    return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function asNumber(value: unknown) {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function coerceStyle(value: unknown): TicketButtonStyle {
    if (value === 'SECONDARY' || value === 'SUCCESS' || value === 'DANGER') return value;
    return 'PRIMARY';
}

function normalizeOpener(raw: unknown, legacy: TicketPanelLegacySource = {}): TicketPanelOpener {
    const source = isRecord(raw) ? raw : {};
    return {
        label: typeof source.label === 'string'
            ? source.label.slice(0, 80)
            : (legacy.buttonText || 'Create Ticket').slice(0, 80),
        emoji: asOptionalString(source.emoji) ?? legacy.buttonEmoji ?? null,
        style: coerceStyle(source.style ?? legacy.buttonStyle),
    };
}

function parseEmbeds(value: unknown): APIEmbed[] {
    let raw = value;
    if (typeof value === 'string') {
        try {
            raw = JSON.parse(value);
        } catch {
            raw = [];
        }
    }
    if (!Array.isArray(raw)) return [];
    return raw.slice(0, 10).filter(isRecord).map((embed): APIEmbed => ({
        title: asOptionalString(embed.title),
        description: asOptionalString(embed.description),
        url: asOptionalString(embed.url),
        color: asNumber(embed.color),
        timestamp: asOptionalString(embed.timestamp),
        footer: isRecord(embed.footer) && asOptionalString(embed.footer.text)
            ? { text: asString(embed.footer.text), icon_url: asOptionalString(embed.footer.icon_url) }
            : undefined,
        image: isRecord(embed.image) && asOptionalString(embed.image.url) ? { url: asString(embed.image.url) } : undefined,
        thumbnail: isRecord(embed.thumbnail) && asOptionalString(embed.thumbnail.url) ? { url: asString(embed.thumbnail.url) } : undefined,
        author: isRecord(embed.author) && asOptionalString(embed.author.name)
            ? { name: asString(embed.author.name), url: asOptionalString(embed.author.url), icon_url: asOptionalString(embed.author.icon_url) }
            : undefined,
        fields: Array.isArray(embed.fields)
            ? embed.fields.filter(isRecord).slice(0, 25).map((field) => ({
                name: asString(field.name).slice(0, 256),
                value: asString(field.value).slice(0, 1024),
                inline: Boolean(field.inline),
            }))
            : undefined,
    }));
}

function defaultDescription(name?: string | null) {
    return name ? `Click the button below to create a ${name} ticket.` : 'Click the button below to create a ticket.';
}

export function createDefaultTicketPanelDesign(name?: string | null): TicketPanelMessageDesign {
    return {
        version: TICKET_PANEL_DESIGN_VERSION,
        mode: 'classic_embed',
        opener: { label: 'Create Ticket', emoji: null, style: 'PRIMARY' },
        content: '',
        embeds: [{
            title: name || 'Create Ticket',
            description: defaultDescription(name),
            color: DEFAULT_COLOR,
        }],
    };
}

export function createComponentsV2TicketPanelDesign(name?: string | null): TicketPanelMessageDesign {
    return {
        version: TICKET_PANEL_DESIGN_VERSION,
        mode: 'components_v2',
        opener: { label: 'Create Ticket', emoji: null, style: 'PRIMARY' },
        flags: COMPONENTS_V2_FLAG,
        components: [{
            type: 17,
            accent_color: DEFAULT_COLOR,
            components: [
                { type: 10, content: `## ${name || 'Create Ticket'}` },
                { type: 10, content: defaultDescription(name) },
                { type: 14, divider: true, spacing: 1 },
            ],
        }],
    };
}

export function designFromLegacy(source: TicketPanelLegacySource): TicketPanelMessageDesign {
    const embeds = parseEmbeds(source.messageEmbeds);
    const fallback = createDefaultTicketPanelDesign(source.name) as Extract<TicketPanelMessageDesign, { mode: 'classic_embed' }>;
    return {
        ...fallback,
        opener: normalizeOpener(null, source),
        content: source.messageText ?? '',
        embeds: embeds.length ? embeds : fallback.embeds,
    };
}

function normalizeMediaItem(value: unknown): V2MediaItem | null {
    if (!isRecord(value) || !isRecord(value.media)) return null;
    return {
        media: { url: asString(value.media.url).slice(0, 2048) },
        description: asOptionalString(value.description),
        spoiler: typeof value.spoiler === 'boolean' ? value.spoiler : undefined,
    };
}

function normalizeLinkButton(value: unknown): V2LinkButton | null {
    if (!isRecord(value) || value.type !== 2 || value.style !== 5) return null;
    return {
        id: typeof value.id === 'number' || typeof value.id === 'string' ? value.id : undefined,
        type: 2,
        style: 5,
        label: asOptionalString(value.label) ?? 'Open link',
        emoji: typeof value.emoji === 'string' || isRecord(value.emoji) ? value.emoji as V2LinkButton['emoji'] : undefined,
        url: asString(value.url).slice(0, 2048),
        disabled: typeof value.disabled === 'boolean' ? value.disabled : undefined,
    };
}

function normalizeThumbnail(value: unknown): V2Thumbnail | null {
    if (!isRecord(value) || value.type !== 11 || !isRecord(value.media)) return null;
    return {
        id: typeof value.id === 'number' || typeof value.id === 'string' ? value.id : undefined,
        type: 11,
        media: { url: asString(value.media.url).slice(0, 2048) },
        description: asOptionalString(value.description),
        spoiler: typeof value.spoiler === 'boolean' ? value.spoiler : undefined,
    };
}

function normalizeTextDisplay(value: unknown): V2TextDisplay | null {
    if (!isRecord(value) || value.type !== 10) return null;
    return {
        id: typeof value.id === 'number' || typeof value.id === 'string' ? value.id : undefined,
        type: 10,
        content: asString(value.content).slice(0, 4000),
    };
}

function normalizeV2Component(value: unknown, nested = false): V2TopLevelComponent | V2Container['components'][number] | null {
    if (!isRecord(value)) return null;

    if (value.type === 10) return normalizeTextDisplay(value);
    if (value.type === 14) {
        return {
            id: typeof value.id === 'number' || typeof value.id === 'string' ? value.id : undefined,
            type: 14,
            divider: typeof value.divider === 'boolean' ? value.divider : true,
            spacing: value.spacing === 2 ? 2 : 1,
        };
    }
    if (value.type === 12 && Array.isArray(value.items)) {
        const items = value.items.map(normalizeMediaItem).filter((item): item is V2MediaItem => item !== null).slice(0, 10);
        return { id: typeof value.id === 'number' || typeof value.id === 'string' ? value.id : undefined, type: 12, items };
    }
    if (value.type === 1 && Array.isArray(value.components)) {
        const components = value.components.map(normalizeLinkButton).filter((item): item is V2LinkButton => item !== null).slice(0, 5);
        return { id: typeof value.id === 'number' || typeof value.id === 'string' ? value.id : undefined, type: 1, components };
    }
    if (value.type === 9 && Array.isArray(value.components)) {
        const components = value.components.map(normalizeTextDisplay).filter((item): item is V2TextDisplay => item !== null).slice(0, 3);
        const thumbnail = normalizeThumbnail(value.accessory);
        const linkButton = normalizeLinkButton(value.accessory);
        return {
            id: typeof value.id === 'number' || typeof value.id === 'string' ? value.id : undefined,
            type: 9,
            components,
            accessory: thumbnail ?? linkButton ?? undefined,
        };
    }
    if (!nested && value.type === 17 && Array.isArray(value.components)) {
        const components = value.components
            .map((component) => normalizeV2Component(component, true))
            .filter((item): item is V2Container['components'][number] => item !== null)
            .slice(0, 10);
        return {
            id: typeof value.id === 'number' || typeof value.id === 'string' ? value.id : undefined,
            type: 17,
            components,
            accent_color: asNumber(value.accent_color),
            spoiler: typeof value.spoiler === 'boolean' ? value.spoiler : undefined,
        };
    }

    return null;
}

function normalizeV2Components(value: unknown, legacy: TicketPanelLegacySource): V2TopLevelComponent[] {
    if (!Array.isArray(value)) {
        return (createComponentsV2TicketPanelDesign(legacy.name) as Extract<TicketPanelMessageDesign, { mode: 'components_v2' }>).components;
    }
    return value.map((component) => normalizeV2Component(component)).filter((item): item is V2TopLevelComponent => item !== null).slice(0, 4);
}

export function normalizeTicketPanelMessageDesign(value: unknown, legacy: TicketPanelLegacySource = {}): TicketPanelMessageDesign {
    if (!isRecord(value)) return designFromLegacy(legacy);

    if (value.mode === 'components_v2') {
        return {
            version: TICKET_PANEL_DESIGN_VERSION,
            mode: 'components_v2',
            opener: normalizeOpener(value.opener, legacy),
            flags: COMPONENTS_V2_FLAG,
            components: normalizeV2Components(value.components, legacy),
        };
    }

    if (value.mode === 'classic_embed') {
        const embeds = parseEmbeds(value.embeds);
        const fallback = createDefaultTicketPanelDesign(legacy.name) as Extract<TicketPanelMessageDesign, { mode: 'classic_embed' }>;
        return {
            version: TICKET_PANEL_DESIGN_VERSION,
            mode: 'classic_embed',
            opener: normalizeOpener(value.opener, legacy),
            content: asString(value.content),
            embeds: Array.isArray(value.embeds) ? embeds : fallback.embeds,
        };
    }

    return designFromLegacy(legacy);
}

export function parseTicketPanelMessageDesign(raw: unknown, legacy: TicketPanelLegacySource = {}): TicketPanelMessageDesign {
    if (typeof raw === 'string' && raw.trim()) {
        try {
            return normalizeTicketPanelMessageDesign(JSON.parse(raw), legacy);
        } catch {
            return designFromLegacy(legacy);
        }
    }
    return normalizeTicketPanelMessageDesign(raw, legacy);
}

export function serializeTicketPanelMessageDesign(design: TicketPanelMessageDesign) {
    return JSON.stringify(normalizeTicketPanelMessageDesign(design));
}

export function legacyFieldsFromDesign(design: TicketPanelMessageDesign): TicketPanelLegacyFields {
    if (design.mode === 'classic_embed') {
        return {
            messageText: design.content.trim() ? design.content : null,
            messageEmbeds: JSON.stringify(design.embeds),
            buttonText: design.opener.label,
            buttonEmoji: design.opener.emoji ?? null,
            buttonStyle: design.opener.style,
        };
    }

    return {
        messageText: null,
        messageEmbeds: JSON.stringify([]),
        buttonText: design.opener.label,
        buttonEmoji: design.opener.emoji ?? null,
        buttonStyle: design.opener.style,
    };
}

function collectV2Text(component: V2TopLevelComponent | V2Container['components'][number]): string[] {
    if (component.type === 10) return [component.content];
    if (component.type === 9) return component.components.flatMap(collectV2Text);
    if (component.type === 17) return component.components.flatMap(collectV2Text);
    return [];
}

function validateV2Component(
    component: V2TopLevelComponent | V2Container['components'][number],
    path: string,
    errors: string[],
) {
    if (component.type === 10) {
        if (!component.content.trim()) errors.push(`${path}: text content is required.`);
        if (component.content.length > 4000) errors.push(`${path}: text content must be 4000 characters or less.`);
        return;
    }
    if (component.type === 1) {
        if (component.components.length === 0) errors.push(`${path}: add at least one button.`);
        if (component.components.length > 5) errors.push(`${path}: Discord allows at most 5 buttons in a row.`);
        component.components.forEach((button, index) => {
            if (!button.label?.trim() && !button.emoji) errors.push(`${path}, button ${index + 1}: add a label or emoji.`);
            if (!button.url.trim()) errors.push(`${path}, button ${index + 1}: URL is required.`);
        });
        return;
    }
    if (component.type === 9) {
        if (component.components.length === 0) errors.push(`${path}: add at least one text display.`);
        if (component.components.length > 3) errors.push(`${path}: a section allows at most 3 text displays.`);
        component.components.forEach((child, index) => validateV2Component(child, `${path}, text ${index + 1}`, errors));
        if (!component.accessory) errors.push(`${path}: an accessory is required.`);
        if (component.accessory?.type === 11 && !component.accessory.media.url.trim()) errors.push(`${path}: thumbnail URL is required.`);
        if (component.accessory?.type === 2 && !component.accessory.url.trim()) errors.push(`${path}: accessory button URL is required.`);
        return;
    }
    if (component.type === 12) {
        if (component.items.length === 0) errors.push(`${path}: add at least one media item.`);
        if (component.items.length > 10) errors.push(`${path}: a gallery allows at most 10 items.`);
        component.items.forEach((item, index) => {
            if (!item.media.url.trim()) errors.push(`${path}, item ${index + 1}: media URL is required.`);
        });
        return;
    }
    if (component.type === 17) {
        if (component.components.length === 0) errors.push(`${path}: add at least one nested component.`);
        if (component.components.length > 10) errors.push(`${path}: a container allows at most 10 components.`);
        component.components.forEach((child, index) => validateV2Component(child, `${path}, component ${index + 1}`, errors));
    }
}

export function validateTicketPanelMessageDesign(design: TicketPanelMessageDesign): string[] {
    const errors: string[] = [];
    if (!design.opener.label.trim()) errors.push('Ticket opener button label is required.');
    if (design.opener.label.length > 80) errors.push('Ticket opener button label must be 80 characters or less.');

    if (design.mode === 'classic_embed') {
        if (!design.content.trim() && design.embeds.length === 0) {
            errors.push('Classic ticket panel needs content or at least one embed.');
        }
        if (design.content.length > 2000) errors.push('Classic message content must be 2000 characters or less.');
        if (design.embeds.length > 10) errors.push('Discord allows at most 10 embeds.');
        design.embeds.forEach((embed, embedIndex) => {
            const prefix = `Embed ${embedIndex + 1}`;
            const hasContent = Boolean(
                embed.title?.trim()
                || embed.description?.trim()
                || embed.author?.name.trim()
                || embed.footer?.text.trim()
                || embed.image?.url.trim()
                || embed.thumbnail?.url.trim()
                || embed.fields?.length,
            );
            if (!hasContent) errors.push(`${prefix}: add content or remove the empty embed.`);
            if ((embed.title?.length ?? 0) > 256) errors.push(`${prefix}: title must be 256 characters or less.`);
            if ((embed.description?.length ?? 0) > 4096) errors.push(`${prefix}: description must be 4096 characters or less.`);
            if ((embed.footer?.text.length ?? 0) > 2048) errors.push(`${prefix}: footer must be 2048 characters or less.`);
            embed.fields?.forEach((field, fieldIndex) => {
                if (!field.name.trim()) errors.push(`${prefix}, field ${fieldIndex + 1}: name is required.`);
                if (!field.value.trim()) errors.push(`${prefix}, field ${fieldIndex + 1}: value is required.`);
            });
        });
        return errors;
    }

    if (design.flags !== COMPONENTS_V2_FLAG) errors.push('Components V2 design must use the IS_COMPONENTS_V2 flag.');
    if (design.components.length === 0) errors.push('Components V2 design needs at least one component.');
    if (design.components.length > 4) errors.push('Components V2 ticket panel allows at most 4 custom top-level components because the opener button is appended by the bot.');

    const textLength = design.components.flatMap(collectV2Text).join('').length;
    if (textLength > 4000) errors.push('Components V2 text display content must be 4000 characters or less in total.');
    design.components.forEach((component, index) => validateV2Component(component, `Component ${index + 1}`, errors));

    return errors;
}
