import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    MessageCreateOptions,
    MessageFlags,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
} from 'discord.js';

export const COMPONENTS_V2_FLAG = 1 << 15;
export const TICKET_PANEL_DESIGN_VERSION = 1;

type TicketButtonStyle = 'PRIMARY' | 'SECONDARY' | 'SUCCESS' | 'DANGER';

type TicketPanelOpener = {
    label: string;
    emoji?: string | null;
    style: TicketButtonStyle;
};

type APIEmbedShape = {
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

type V2MediaItem = {
    media: { url: string };
    description?: string;
    spoiler?: boolean;
};

type V2TextDisplay = {
    id?: number | string;
    type: 10;
    content: string;
};

type V2Thumbnail = {
    id?: number | string;
    type: 11;
    media: { url: string };
    description?: string;
    spoiler?: boolean;
};

type V2MediaGallery = {
    id?: number | string;
    type: 12;
    items: V2MediaItem[];
};

type V2Separator = {
    id?: number | string;
    type: 14;
    divider?: boolean;
    spacing?: 1 | 2;
};

type V2LinkButton = {
    id?: number | string;
    type: 2;
    style: 5;
    label?: string;
    emoji?: { id?: string | null; name?: string | null; animated?: boolean } | string | null;
    url: string;
    disabled?: boolean;
};

type V2ActionRow = {
    id?: number | string;
    type: 1;
    components: V2LinkButton[];
};

type V2Section = {
    id?: number | string;
    type: 9;
    components: V2TextDisplay[];
    accessory?: V2Thumbnail | V2LinkButton;
};

type V2Container = {
    id?: number | string;
    type: 17;
    components: Array<V2ActionRow | V2TextDisplay | V2Section | V2MediaGallery | V2Separator>;
    accent_color?: number;
    spoiler?: boolean;
};

type V2TopLevelComponent =
    | V2ActionRow
    | V2TextDisplay
    | V2Section
    | V2MediaGallery
    | V2Separator
    | V2Container;

type TicketPanelMessageDesign =
    | {
        version: 1;
        mode: 'classic_embed';
        opener: TicketPanelOpener;
        content: string;
        embeds: APIEmbedShape[];
    }
    | {
        version: 1;
        mode: 'components_v2';
        opener: TicketPanelOpener;
        flags: typeof COMPONENTS_V2_FLAG;
        components: V2TopLevelComponent[];
    };

export type TicketPanelDesignSource = {
    id: number;
    name: string;
    messageDesignJson?: string | null;
    messageText: string | null;
    messageEmbeds: string | null;
    buttonText: string;
    buttonEmoji: string | null;
    buttonStyle: string;
    items?: TicketPanelItem[];
};

export type TicketPanelItem = {
    id: number;
    type: string;
    label: string;
    description: string | null;
    emoji: string | null;
    replyContent: string | null;
};

type EntryItemConfig = {
    presentation: 'button' | 'select' | 'both';
    style: TicketButtonStyle;
    fields: Array<{ id?: string; label: string; type: string; required: boolean; options?: string[] }>;
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

function normalizeOpener(raw: unknown, source: Partial<TicketPanelDesignSource>): TicketPanelOpener {
    const opener = isRecord(raw) ? raw : {};
    return {
        label: typeof opener.label === 'string'
            ? opener.label.slice(0, 80)
            : (source.buttonText || 'Create Ticket').slice(0, 80),
        emoji: asOptionalString(opener.emoji) ?? source.buttonEmoji ?? null,
        style: coerceStyle(opener.style ?? source.buttonStyle),
    };
}

function parseEmbeds(value: unknown): APIEmbedShape[] {
    let raw = value;
    if (typeof value === 'string') {
        try {
            raw = JSON.parse(value);
        } catch {
            raw = [];
        }
    }
    if (!Array.isArray(raw)) return [];
    return raw.slice(0, 10).filter(isRecord).map((embed): APIEmbedShape => ({
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

function createDefaultTicketPanelDesign(name?: string | null): TicketPanelMessageDesign {
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

function createComponentsV2TicketPanelDesign(name?: string | null): TicketPanelMessageDesign {
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

function designFromLegacy(source: TicketPanelDesignSource): TicketPanelMessageDesign {
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

function normalizeV2Components(value: unknown, source: TicketPanelDesignSource): V2TopLevelComponent[] {
    if (!Array.isArray(value)) {
        return (createComponentsV2TicketPanelDesign(source.name) as Extract<TicketPanelMessageDesign, { mode: 'components_v2' }>).components;
    }
    return value.map((component) => normalizeV2Component(component)).filter((item): item is V2TopLevelComponent => item !== null).slice(0, 4);
}

export function parseTicketPanelMessageDesign(source: TicketPanelDesignSource, overrideRaw?: unknown): TicketPanelMessageDesign {
    const raw = overrideRaw ?? source.messageDesignJson;
    if (typeof raw === 'string' && raw.trim()) {
        try {
            return normalizeTicketPanelMessageDesign(JSON.parse(raw), source);
        } catch {
            return designFromLegacy(source);
        }
    }
    return normalizeTicketPanelMessageDesign(raw, source);
}

function normalizeTicketPanelMessageDesign(value: unknown, source: TicketPanelDesignSource): TicketPanelMessageDesign {
    if (!isRecord(value)) return designFromLegacy(source);

    if (value.mode === 'components_v2') {
        return {
            version: TICKET_PANEL_DESIGN_VERSION,
            mode: 'components_v2',
            opener: normalizeOpener(value.opener, source),
            flags: COMPONENTS_V2_FLAG,
            components: normalizeV2Components(value.components, source),
        };
    }

    if (value.mode === 'classic_embed') {
        const embeds = parseEmbeds(value.embeds);
        const fallback = createDefaultTicketPanelDesign(source.name) as Extract<TicketPanelMessageDesign, { mode: 'classic_embed' }>;
        return {
            version: TICKET_PANEL_DESIGN_VERSION,
            mode: 'classic_embed',
            opener: normalizeOpener(value.opener, source),
            content: asString(value.content),
            embeds: Array.isArray(value.embeds) ? embeds : fallback.embeds,
        };
    }

    return designFromLegacy(source);
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
        if (!design.content.trim() && design.embeds.length === 0) errors.push('Classic ticket panel needs content or at least one embed.');
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

function parseButtonStyle(style: TicketButtonStyle): ButtonStyle {
    switch (style) {
        case 'SECONDARY': return ButtonStyle.Secondary;
        case 'SUCCESS': return ButtonStyle.Success;
        case 'DANGER': return ButtonStyle.Danger;
        default: return ButtonStyle.Primary;
    }
}

function buildOpenerRow(categoryId: number, opener: TicketPanelOpener) {
    const button = new ButtonBuilder()
        .setCustomId(`tk_open:${categoryId}`)
        .setLabel(opener.label || 'Create Ticket')
        .setStyle(parseButtonStyle(opener.style));

    if (opener.emoji?.trim()) {
        try {
            button.setEmoji(opener.emoji.trim());
        } catch {
            // Invalid emoji is ignored; the button remains usable.
        }
    }

    return new ActionRowBuilder<ButtonBuilder>().addComponents(button);
}

export function parseEntryItemConfig(item: Pick<TicketPanelItem, 'type' | 'replyContent'>): EntryItemConfig | null {
    if (item.type !== 'ENTRY' && item.type !== 'DEPARTMENT' && item.type !== 'BUTTON') return null;
    let source: Record<string, unknown> = {};
    try {
        const parsed = item.replyContent ? JSON.parse(item.replyContent) : {};
        if (isRecord(parsed)) source = parsed;
    } catch { /* legacy item */ }
    const presentation = source.presentation === 'button' || source.presentation === 'select' || source.presentation === 'both'
        ? source.presentation
        : item.type === 'BUTTON' ? 'button' : 'select';
    const style = source.style === 'SECONDARY' || source.style === 'SUCCESS' || source.style === 'DANGER' ? source.style : 'PRIMARY';
    const fields = Array.isArray(source.fields) ? source.fields.slice(0, 5).map((field, index) => {
        const value = isRecord(field) ? field : {};
        return {
            id: typeof value.id === 'string' ? value.id : `field-${index + 1}`,
            label: typeof value.label === 'string' ? value.label.slice(0, 45) : `Question ${index + 1}`,
            type: typeof value.type === 'string' ? value.type : 'short',
            required: value.required !== false,
            options: Array.isArray(value.options) ? value.options.filter((option): option is string => typeof option === 'string').slice(0, 25) : undefined,
        };
    }) : [];
    return { presentation, style, fields };
}

export function parseGhostReply(item: Pick<TicketPanelItem, 'type' | 'replyContent'>): string | null {
    if (item.type !== 'REPLY') return null;
    if (!item.replyContent) return '';
    try {
        const parsed = JSON.parse(item.replyContent);
        if (isRecord(parsed) && parsed.kind === 'ghost' && typeof parsed.response === 'string') return parsed.response;
    } catch { /* legacy plaintext reply */ }
    return item.replyContent;
}

function applyButtonEmoji(button: ButtonBuilder, emoji?: string | null) {
    if (!emoji?.trim()) return;
    try { button.setEmoji(emoji.trim()); } catch { /* invalid emoji is ignored */ }
}

function applyOptionEmoji(option: StringSelectMenuOptionBuilder, emoji?: string | null) {
    if (!emoji?.trim()) return;
    try { option.setEmoji(emoji.trim()); } catch { /* invalid emoji is ignored */ }
}

function buildFlowRows(category: TicketPanelDesignSource, opener: TicketPanelOpener) {
    const items = Array.isArray(category.items) ? category.items : [];
    const entries = items.map((item) => ({ item, config: parseEntryItemConfig(item) })).filter((entry): entry is { item: TicketPanelItem; config: EntryItemConfig } => Boolean(entry.config));
    const replies = items.filter((item) => item.type === 'REPLY').slice(0, 25);
    const rows: Array<ActionRowBuilder<ButtonBuilder> | ActionRowBuilder<StringSelectMenuBuilder>> = [];
    const buttonEntries = entries.filter(({ config }) => config.presentation === 'button' || config.presentation === 'both').slice(0, 5);
    if (buttonEntries.length) {
        const row = new ActionRowBuilder<ButtonBuilder>();
        buttonEntries.forEach(({ item, config }) => {
            const button = new ButtonBuilder().setCustomId(`tk_entry:${category.id}:${item.id}`).setLabel(item.label.slice(0, 80)).setStyle(parseButtonStyle(config.style));
            applyButtonEmoji(button, item.emoji);
            row.addComponents(button);
        });
        rows.push(row);
    }
    const selectEntries = entries.filter(({ config }) => config.presentation === 'select' || config.presentation === 'both').slice(0, 25);
    if (selectEntries.length) {
        const select = new StringSelectMenuBuilder().setCustomId(`tk_entry:${category.id}`).setPlaceholder('Select a ticket topic…');
        selectEntries.forEach(({ item }) => {
            const option = new StringSelectMenuOptionBuilder().setValue(String(item.id)).setLabel(item.label.slice(0, 100));
            if (item.description?.trim()) option.setDescription(item.description.trim().slice(0, 100));
            applyOptionEmoji(option, item.emoji);
            select.addOptions(option);
        });
        rows.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select));
    }
    if (replies.length) {
        const select = new StringSelectMenuBuilder().setCustomId(`tk_ghost:${category.id}`).setPlaceholder('Quick answers · visible only to you');
        replies.forEach((item) => {
            const option = new StringSelectMenuOptionBuilder().setValue(String(item.id)).setLabel(item.label.slice(0, 100));
            if (item.description?.trim()) option.setDescription(item.description.trim().slice(0, 100));
            applyOptionEmoji(option, item.emoji);
            select.addOptions(option);
        });
        rows.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select));
    }
    if (!entries.length) rows.unshift(buildOpenerRow(category.id, opener));
    return rows.slice(0, 5);
}

function embedFromDesign(embed: APIEmbedShape): EmbedBuilder {
    const builder = new EmbedBuilder();
    if (embed.title) builder.setTitle(embed.title);
    if (embed.description) builder.setDescription(embed.description);
    if (embed.url) builder.setURL(embed.url);
    if (typeof embed.color === 'number') builder.setColor(embed.color);
    if (embed.timestamp) builder.setTimestamp(new Date(embed.timestamp));
    if (embed.footer?.text) builder.setFooter({ text: embed.footer.text, iconURL: embed.footer.icon_url });
    if (embed.image?.url) builder.setImage(embed.image.url);
    if (embed.thumbnail?.url) builder.setThumbnail(embed.thumbnail.url);
    if (embed.author?.name) builder.setAuthor({ name: embed.author.name, url: embed.author.url, iconURL: embed.author.icon_url });
    if (Array.isArray(embed.fields) && embed.fields.length) builder.addFields(embed.fields);
    return builder;
}

function buildClassicPayload(category: TicketPanelDesignSource, design: Extract<TicketPanelMessageDesign, { mode: 'classic_embed' }>): MessageCreateOptions {
    const embeds = design.embeds.length
        ? design.embeds.map(embedFromDesign)
        : [embedFromDesign({ title: category.name, description: defaultDescription(category.name), color: DEFAULT_COLOR })];

    return {
        content: design.content.trim() ? design.content : undefined,
        embeds,
        components: buildFlowRows(category, design.opener),
    };
}

function buildComponentsV2Payload(category: TicketPanelDesignSource, design: Extract<TicketPanelMessageDesign, { mode: 'components_v2' }>): MessageCreateOptions {
    const controlRows = buildFlowRows(category, design.opener);
    return {
        flags: MessageFlags.IsComponentsV2,
        components: [
            ...design.components.slice(0, Math.max(0, 5 - controlRows.length)),
            ...controlRows.map((row) => row.toJSON()),
        ] as any,
    };
}

export function buildTicketPanelPayload(category: TicketPanelDesignSource, overrideRaw?: unknown): MessageCreateOptions {
    const design = parseTicketPanelMessageDesign(category, overrideRaw);
    const errors = validateTicketPanelMessageDesign(design);
    if (errors.length) {
        throw new Error(errors.join(' '));
    }

    return design.mode === 'components_v2'
        ? buildComponentsV2Payload(category, design)
        : buildClassicPayload(category, design);
}
