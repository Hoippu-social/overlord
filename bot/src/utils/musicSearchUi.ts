import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    TextInputBuilder,
    TextInputStyle,
} from 'discord.js';
import { LocaleCode, t } from './i18n';

type SearchTrack = {
    info: {
        title: string;
        author?: string;
        duration?: number;
    };
};

export function getSearchPlatformName(prefix: string) {
    if (prefix === 'spsearch:') return 'Spotify';
    if (prefix === 'scsearch:') return 'SoundCloud';
    return 'YouTube';
}

export function buildSearchComponents(locale: LocaleCode, userId: string, tracks: SearchTrack[], selectedPrefix: string) {
    const platformName = getSearchPlatformName(selectedPrefix);
    const platformSelect = new StringSelectMenuBuilder()
        .setCustomId(`search_platform_${userId}`)
        .setPlaceholder(t(locale, selectedPrefix === 'ytsearch:' ? 'search.platformPlaceholder' : 'search.platformPlaceholderSelected', { platform: platformName }))
        .addOptions(
            new StringSelectMenuOptionBuilder()
                .setLabel('YouTube')
                .setDescription(t(locale, 'search.platformDesc.youtube'))
                .setValue('ytsearch:')
                .setEmoji('🔴')
                .setDefault(selectedPrefix === 'ytsearch:'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Spotify')
                .setDescription(t(locale, 'search.platformDesc.spotify'))
                .setValue('spsearch:')
                .setEmoji('🟢')
                .setDefault(selectedPrefix === 'spsearch:'),
            new StringSelectMenuOptionBuilder()
                .setLabel('SoundCloud')
                .setDescription(t(locale, 'search.platformDesc.soundcloud'))
                .setValue('scsearch:')
                .setEmoji('🟠')
                .setDefault(selectedPrefix === 'scsearch:')
        );

    const trackSelect = new StringSelectMenuBuilder()
        .setCustomId(`search_track_${userId}`)
        .setPlaceholder(t(locale, 'search.trackPlaceholder'))
        .addOptions(
            tracks.map((track, index) => {
                const duration = track.info.duration
                    ? `[${Math.floor(track.info.duration / 60000)}:${Math.floor((track.info.duration % 60000) / 1000).toString().padStart(2, '0')}]`
                    : '';
                return new StringSelectMenuOptionBuilder()
                    .setLabel(track.info.title.substring(0, 85))
                    .setDescription(`${track.info.author ?? '-'} ${duration}`.trim().substring(0, 100))
                    .setValue(index.toString());
            })
        );

    const changeButton = new ButtonBuilder()
        .setCustomId(`search_change_${userId}`)
        .setLabel(t(locale, 'search.changeLabel'))
        .setStyle(ButtonStyle.Secondary);

    const cancelButton = new ButtonBuilder()
        .setCustomId(`search_cancel_${userId}`)
        .setLabel(t(locale, 'search.cancelLabel'))
        .setStyle(ButtonStyle.Danger);

    return [
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(platformSelect),
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(trackSelect),
        new ActionRowBuilder<ButtonBuilder>().addComponents(changeButton, cancelButton),
    ];
}

export function buildSearchModal(locale: LocaleCode, userId: string, value: string) {
    const modal = new ModalBuilder()
        .setCustomId(`search_modal_${userId}`)
        .setTitle(t(locale, 'search.modalTitle'));

    const queryInput = new TextInputBuilder()
        .setCustomId('search_query')
        .setLabel(t(locale, 'search.modalLabel'))
        .setStyle(TextInputStyle.Short)
        .setPlaceholder(t(locale, 'search.modalPlaceholder'))
        .setValue(String(value))
        .setRequired(true);

    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(queryInput));
    return modal;
}
