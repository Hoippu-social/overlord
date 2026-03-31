import { APIEmbedField, ChatInputCommandInteraction, ColorResolvable, EmbedBuilder, User } from 'discord.js';

export type StaffEmbedField = {
    label: string;
    value: string;
    inline?: boolean;
};

type StaffEmbedOptions = {
    actor: User;
    title: string;
    color?: ColorResolvable;
    description?: string[];
    fields?: StaffEmbedField[];
    thumbnailUrl?: string | null;
    footer?: string;
};

function sanitizeCodeBlock(value: string) {
    return value.replace(/```/g, '```\u200b').trim() || '-';
}

export function buildStaffCodeField(label: string, value: string, inline = true): APIEmbedField {
    return {
        name: '\u200b',
        value: `> **${label}**\n\`\`\`text\n${sanitizeCodeBlock(value)}\n\`\`\``,
        inline,
    };
}

export function buildStaffEmbed(options: StaffEmbedOptions) {
    const embed = new EmbedBuilder()
        .setColor(options.color ?? 0x10131a)
        .setAuthor({
            name: options.actor.tag,
            iconURL: options.actor.displayAvatarURL({ size: 128 }),
        })
        .setDescription([`**${options.title}**`, ...(options.description ?? [])].join('\n'));

    if (options.thumbnailUrl) {
        embed.setThumbnail(options.thumbnailUrl);
    }

    if (options.fields?.length) {
        embed.addFields(
            options.fields.map((field) => buildStaffCodeField(field.label, field.value, field.inline))
        );
    }

    if (options.footer) {
        embed.setFooter({ text: options.footer });
    }

    return embed;
}

export async function replyWithStaffEmbed(
    interaction: ChatInputCommandInteraction,
    options: StaffEmbedOptions & { ephemeral?: boolean }
) {
    const embed = buildStaffEmbed(options);
    await interaction.reply({
        embeds: [embed],
        ephemeral: options.ephemeral ?? true,
    });
}
