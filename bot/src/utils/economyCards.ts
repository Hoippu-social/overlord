import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ContainerBuilder,
    MessageFlags,
    SeparatorBuilder,
    SeparatorSpacingSize,
    StringSelectMenuBuilder,
    TextDisplayBuilder,
    type InteractionReplyOptions,
    type MessageEditOptions,
} from 'discord.js';

// Components v2 message helpers for the economy module. Every economy command/game
// response is a v2 Container — no legacy embeds. Money/state is rendered as markdown
// text-display blocks inside a colored container, with interactive rows below.

export const ACCENT = {
    primary: 0x57f287, // green — matches the economy audit tag color
    violet: 0x8f5eff,
    gold: 0xf1c40f,
    danger: 0xed4245,
    neutral: 0x2b2d31,
    info: 0x5865f2,
} as const;

export type CardButton = {
    id: string;
    label: string;
    style?: ButtonStyle;
    emoji?: string;
    disabled?: boolean;
};

export type CardSelect = {
    id: string;
    placeholder: string;
    options: { label: string; value: string; description?: string; emoji?: string; default?: boolean }[];
    disabled?: boolean;
};

export interface CardSpec {
    accent?: number;
    /** Big heading line (rendered as `## title`). */
    title?: string;
    /** Optional subtitle under the title (muted). */
    subtitle?: string;
    /** Body markdown blocks; each becomes its own text-display, separated visually. */
    body?: string[];
    /** Small key/value stat rows rendered as a compact markdown block. */
    fields?: { label: string; value: string; inline?: boolean }[];
    /** A muted footer line at the bottom. */
    footer?: string;
    /** Rows of buttons (max 5 buttons per row, max 5 rows total incl. selects). */
    buttonRows?: CardButton[][];
    /** Select menus, each on its own row. */
    selects?: CardSelect[];
}

function styleOf(style?: ButtonStyle): ButtonStyle {
    return style ?? ButtonStyle.Secondary;
}

function buildButtonRow(buttons: CardButton[]): ActionRowBuilder<ButtonBuilder> {
    const row = new ActionRowBuilder<ButtonBuilder>();
    for (const b of buttons.slice(0, 5)) {
        const btn = new ButtonBuilder()
            .setCustomId(b.id)
            .setLabel(b.label)
            .setStyle(styleOf(b.style))
            .setDisabled(!!b.disabled);
        if (b.emoji) btn.setEmoji(b.emoji);
        row.addComponents(btn);
    }
    return row;
}

function buildSelectRow(select: CardSelect): ActionRowBuilder<StringSelectMenuBuilder> {
    const menu = new StringSelectMenuBuilder()
        .setCustomId(select.id)
        .setPlaceholder(select.placeholder)
        .setDisabled(!!select.disabled)
        .addOptions(
            select.options.slice(0, 25).map((o) => ({
                label: o.label,
                value: o.value,
                description: o.description,
                emoji: o.emoji,
                default: o.default,
            }))
        );
    return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);
}

/** Assemble a v2 Container from a declarative spec. */
export function buildCard(spec: CardSpec): ContainerBuilder {
    const container = new ContainerBuilder().setAccentColor(spec.accent ?? ACCENT.primary);

    const headParts: string[] = [];
    if (spec.title) headParts.push(`## ${spec.title}`);
    if (spec.subtitle) headParts.push(`-# ${spec.subtitle}`);
    if (headParts.length) {
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(headParts.join('\n')));
    }

    if (spec.body && spec.body.length) {
        if (headParts.length) {
            container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
        }
        for (const block of spec.body) {
            container.addTextDisplayComponents(new TextDisplayBuilder().setContent(block));
        }
    }

    if (spec.fields && spec.fields.length) {
        const lines = spec.fields.map((f) => `**${f.label}**\n${f.value}`);
        container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join('\n\n')));
    }

    if (spec.footer) {
        container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${spec.footer}`));
    }

    for (const select of spec.selects ?? []) {
        container.addActionRowComponents(buildSelectRow(select));
    }

    for (const row of spec.buttonRows ?? []) {
        if (row.length) container.addActionRowComponents(buildButtonRow(row));
    }

    return container;
}

/** Reply payload for an interaction, using Components v2. */
export function cardReply(spec: CardSpec, opts?: { ephemeral?: boolean }): InteractionReplyOptions {
    return {
        flags: opts?.ephemeral ? MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral : MessageFlags.IsComponentsV2,
        components: [buildCard(spec)],
    };
}

/** Edit payload (for button updates / editReply), using Components v2. */
export function cardEdit(spec: CardSpec): MessageEditOptions {
    return {
        flags: MessageFlags.IsComponentsV2,
        components: [buildCard(spec)],
    };
}

/** Compact currency label: "1 380 ✦" / "1 380 coins". */
export function money(amount: bigint | number | string, currency: { name: string; emoji: string | null }): string {
    let s = typeof amount === 'string' ? amount : amount.toString();
    let neg = false;
    if (s.startsWith('-')) { neg = true; s = s.slice(1); }
    const grouped = s.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    const sym = currency.emoji || currency.name;
    return `${neg ? '-' : ''}${grouped} ${sym}`;
}
