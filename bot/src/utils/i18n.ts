import { ChatInputCommandInteraction, Interaction } from 'discord.js';
import { prisma } from './database';

export type LocaleCode = 'ru' | 'en';

const DEFAULT_LOCALE: LocaleCode = 'ru';
const LOCALE_TTL_MS = 5 * 60 * 1000;

const translations: Record<LocaleCode, Record<string, string>> = {
    en: {
        // General
        'general.guildOnly': 'This command can only be used inside a server.',
        'general.notAdmin': 'You need administrator permissions to use this command.',
        'general.notVoice': 'You need to be in a voice channel.',
        'general.notSameVoice': 'You need to be in the same voice channel as the bot.',
        'general.playerMissing': 'Player is not active.',
        'general.playerNotFound': 'Player not found.',
        'general.nothingPlaying': 'Nothing is playing right now.',
        'general.noQueue': 'No music queue found for this server.',
        'general.notForYou': 'This action is not for you.',
        'general.serverUnknown': 'Unable to identify server.',
        'general.commandError': 'There was an error while executing this command!',
        'general.error': 'Something went wrong. Please try again later.',
        'general.unknown': 'Unknown',
        'general.notSet': 'not set',
        'general.unlimited': 'no limit',
        'general.ping': 'Pong!',

        // Admin
        'admin.shutdown.confirm': 'Shutting down bot...',

        // Help
        'help.overviewDescription': 'Pick a module below to see details. You can also run `/help command:<name>` for a specific command.',
        'help.footer': 'Tip: run /help again if the menu disappeared',
        'help.commandNotFound': 'Command `/{command}` is not known. Check the spelling or pick from the list.',
        'help.details.title': '/{command}',
        'help.details.module': 'Module',
        'help.details.access': 'Access',
        'help.details.more': 'Details',

        // Search
        'search.title': '🎵 Search results for: **{query}**',
        'search.noResults': 'No results found.',
        'search.pendingMissing': 'No pending search found.',
        'search.cancelled': '❌ Search cancelled',
        'search.invalidSelection': 'Invalid track selection.',
        'search.trackAdded': '✅ **{title}** added to queue!',
        'search.queryExtractFailed': 'Could not retrieve query from message.',
        'search.noResultsOn': 'No results found on {platform}.',
        'search.error': 'Error searching.',
        'search.platformPlaceholder': 'Platform: {platform}',
        'search.platformPlaceholderSelected': 'Selected platform: {platform}',
        'search.platformDesc.youtube': 'Search videos on YouTube',
        'search.platformDesc.spotify': 'Search tracks on Spotify',
        'search.platformDesc.soundcloud': 'Search on SoundCloud',
        'search.trackPlaceholder': 'Select a track',
        'search.changeLabel': 'Change search',
        'search.cancelLabel': 'Cancel',
        'search.modalTitle': 'Change search query',
        'search.modalLabel': 'Enter query',
        'search.modalPlaceholder': 'Track, artist, album...',

        // Music
        'music.play.failedCreate': 'Failed to create player.',
        'music.play.playlistAdded': 'Playlist **{name}** added! ({count} tracks)',
        'music.play.trackEnqueued': '**{title}** enqueued!',
        'music.play.unknownPlaylist': 'Unknown playlist',
        'music.play.searchPrompt': '🎵 Search results for: **{query}**',
        'music.play.errorLoading': 'An error occurred while loading the track.',
        'music.play.errorGeneric': 'An error occurred while trying to play music.',
        'music.play.sameChannel': 'You need to be in the same voice channel as the bot.',
        'music.pause.done': 'Player paused.',
        'music.pause.already': 'Already paused. Use `/resume` to continue.',
        'music.resume.done': 'Player resumed.',
        'music.resume.already': 'Already playing.',
        'music.skip.done': '⏭️ Skipped **{title}**.',
        'music.stop.noPlayer': 'No music is currently playing.',
        'music.stop.done': 'Stopped the music and disconnected.',
        'music.shuffle.tooShort': 'Queue needs at least 2 tracks to shuffle.',
        'music.shuffle.done': '🔀 Queue shuffled. ({count} tracks)',
        'music.loop.set.off': 'Loop mode: off.',
        'music.loop.set.track': 'Loop mode: current track.',
        'music.loop.set.queue': 'Loop mode: whole queue.',
        'music.seek.invalid': 'Please provide position like `1:30`, `90` or `1m30s`.',
        'music.seek.tooFar': 'Position is beyond track duration.',
        'music.seek.done': 'Seeked to **{position}**.',
        'music.volume.current': 'Current volume: **{value}%**',
        'music.volume.set': 'Volume set to **{value}%**.',
        'music.queue.invalidPage': 'Invalid page. Total pages: {pages}.',
        'music.queue.title': '📜 Music queue',
        'music.queue.current': '🎶 Now playing:',
        'music.queue.next': 'Up next:',
        'music.queue.empty': '*Queue is empty*',
        'music.queue.loop.track': 'Loop: track',
        'music.queue.loop.queue': 'Loop: queue',
        'music.queue.loop.off': 'Loop: off',
        'music.queue.footer': 'Page {page}/{pages} | {count} tracks | Total duration: {duration}',
        'music.nowplaying.title': '🎶 Now playing',
        'music.nowplaying.field.author': 'Author',
        'music.nowplaying.field.progress': 'Progress',
        'music.nowplaying.field.volume': 'Volume',
        'music.nowplaying.field.queue': 'Queue',
        'music.nowplaying.field.loop': 'Loop',
        'music.nowplaying.field.paused': 'Paused',
        'music.nowplaying.loop.track': 'Track',
        'music.nowplaying.loop.queue': 'Queue',
        'music.nowplaying.loop.off': 'Off',
        'music.nowplaying.paused': 'Yes',
        'music.nowplaying.queueCount': '{count} tracks',
        'music.nowplaying.requester': 'Requested by',
        'music.player.field.volume': 'Volume',
        'music.player.field.author': 'Author',
        'music.player.field.duration': 'Duration',
        'music.player.field.requester': 'Requested by',
        'music.player.field.loop': 'Loop',
        'music.player.loop.off': 'Off',
        'music.player.loop.track': 'Track',
        'music.player.loop.queue': 'Queue',

        // Temp voice
        'tempvoice.enabled': [
            'Temporary rooms enabled.',
            'Hub: <#{hub}>',
            'Category: {category}',
            'Name template: {template}',
            'User limit: {limit}',
        ].join('\n'),
        'tempvoice.hubMustBeVoice': 'Hub must be a voice channel.',
        'tempvoice.notManager': 'You need the Manage Channels permission to configure temp rooms.',
        'tempvoice.failedSave': 'Failed to save configuration, please try again later.',
        'tempvoice.statusMissing': 'Temp rooms are not configured yet.',
        'tempvoice.status': [
            'Hub: <#{hub}>',
            'Category: {category}',
            'Name template: {template}',
            'User limit: {limit}',
        ].join('\n'),
        'tempvoice.disable.missing': 'Temp rooms are already disabled.',
        'tempvoice.disable.done': 'Temp rooms disabled and active rooms removed.',
        'tempvoice.failedLoad': 'Failed to load configuration.',
        'tempvoice.disable.failed': 'Failed to disable temp rooms.',
        'tempvoice.unknownSubcommand': 'Unknown subcommand.',

        // Setupv
        'setupv.guildOnly': 'This command can only be used inside a server.',
        'setupv.notManager': 'You need the Manage Channels permission.',
        'setupv.summary': [
            'Temporary voice system created:',
            'Category: {category}',
            'Hub: {hub}',
            'Control channel: {panel}',
            'Name template: {template}',
            'User limit: {limit}',
        ].join('\n'),
        'setupv.error': 'Failed to set up temp voice. Please try again later.',
        'setupv.embed.title': 'Temporary room controls',
        'setupv.embed.desc': [
            'Join the lobby to create a private room.',
            'Use the buttons below to manage your room:',
            '• 👑 Claim ownership',
            '• ✅ Permit user',
            '• 🚫 Block user',
            '• 👥 Set limit',
            '• 🔒 Lock / unlock',
            '• ✏️ Rename',
            '• 🙈 Hide / show',
            '• 👢 Kick user',
            '• 🎙️ Toggle speak',
        ].join('\n'),

        // Interaction restrictions
        'interactions.musicChannelWhitelist': 'You must be in a whitelisted Voice Channel to use music commands.',
        'interactions.musicChannelBlacklist': 'Music commands are not allowed in this Voice Channel.',
        'interactions.djOnly': 'DJ Mode is enabled. You need a DJ role to use music commands.',
        'interactions.playerNotReady': 'Player is not ready.',
        'interactions.queueMissing': 'No music queue found for this server.',
        'interactions.sameChannelRequired': 'You need to be in the same voice channel as the bot.',
        'interactions.prevTrackMissing': 'No previous track available.',
        'interactions.queueCheck': '**Queue:**\n{tracks}',
        'interactions.queueTitle': 'Current Queue',
        'interactions.queueEmpty': 'Queue is empty',
        'interactions.playFailed': 'Failed to play: {error}',

        // Voice interactions
        'voice.notInVoice': 'Join a voice channel to use room controls.',
        'voice.notTempRoom': 'This room is not managed by the temp voice system.',
        'voice.ownerOnly.rename': 'Only the room owner can rename the room.',
        'voice.ownerOnly.limit': 'Only the room owner can change the user limit.',
        'voice.ownerOnly.lock': 'Only the room owner can lock or unlock the room.',
        'voice.ownerOnly.kick': 'Only the room owner can kick users.',
        'voice.ownerOnly.block': 'Only the room owner can block users.',
        'voice.ownerOnly.permit': 'Only the room owner can permit users.',
        'voice.ownerOnly.hide': 'Only the room owner can hide or show the room.',
        'voice.ownerOnly.speak': 'Only the room owner can restrict speaking.',
        'voice.ownerOnly.panel': 'Only the room owner can use this panel.',
        'voice.modal.rename.title': 'Rename room',
        'voice.modal.rename.label': 'New name',
        'voice.modal.limit.title': 'Set user limit',
        'voice.modal.limit.label': 'Maximum users (0-99)',
        'voice.modal.limit.placeholder': 'Example: 8',
        'voice.select.limit.placeholder': 'Choose a limit',
        'voice.select.limit.custom': 'Custom value...',
        'voice.select.limit.none': 'No limit',
        'voice.select.limit.prompt': 'Pick a limit for your room:',
        'voice.select.kick.placeholder': 'Select users to kick',
        'voice.select.kick.prompt': 'Who should be removed from the room?',
        'voice.select.kick.empty': 'No one to kick — you are alone.',
        'voice.select.block.prompt': 'Choose users to block',
        'voice.select.permit.prompt': 'Choose users to permit',
        'voice.rename.empty': 'Room name cannot be empty.',
        'voice.rename.updated': 'Room name updated to **{name}**.',
        'voice.limit.invalid': 'Enter a number from 0 to 99.',
        'voice.limit.updated': 'Limit updated: {limit}.',
        'voice.kick.done': 'Kicked {count} user(s).',
        'voice.kick.none': 'No users were kicked.',
        'voice.block.updated': 'Access updated: users were blocked.',
        'voice.permit.updated': 'Access updated: users were permitted.',
        'voice.locked': 'Room locked (only permitted users can join).',
        'voice.unlocked': 'Room unlocked.',
        'voice.claim.alreadyOwner': 'You already own this room.',
        'voice.claim.ownerInside': 'Current owner is still in the room. You cannot claim it.',
        'voice.claim.success': 'You are now the room owner.',
        'voice.hide.shown': 'Room is now visible to everyone.',
        'voice.hide.hidden': 'Room is now hidden from everyone.',
        'voice.speak.allowed': 'Everyone can speak now.',
        'voice.speak.restricted': 'Speaking is now restricted.',
    },
    ru: {
        // General
        'general.guildOnly': 'Эту команду можно использовать только на сервере.',
        'general.notAdmin': 'Нужны права администратора для этой команды.',
        'general.notVoice': 'Зайдите в голосовой канал.',
        'general.notSameVoice': 'Нужно быть в том же голосовом канале, что и бот.',
        'general.playerMissing': 'Плеер неактивен.',
        'general.playerNotFound': 'Плеер не найден.',
        'general.nothingPlaying': 'Сейчас ничего не играет.',
        'general.noQueue': 'Для этого сервера нет очереди музыки.',
        'general.notForYou': 'Это действие открывал другой пользователь.',
        'general.serverUnknown': 'Не удалось определить сервер.',
        'general.commandError': 'Произошла ошибка при выполнении команды.',
        'general.error': 'Что-то пошло не так. Попробуйте позже.',
        'general.unknown': 'Неизвестно',
        'general.notSet': 'Не задано',
        'general.unlimited': 'Без лимита',
        'general.ping': 'Pong!',

        // Admin
        'admin.shutdown.confirm': 'Выключаю бота...',

        // Help
        'help.overviewDescription': 'Выбери модуль в меню ниже, чтобы увидеть подробности. Подробно по команде: `/help command:<имя>`.',
        'help.footer': 'Подсказка: вызови /help снова, если меню пропало',
        'help.commandNotFound': 'Команда `/{command}` не найдена. Проверь написание или выбери из списка.',
        'help.details.title': '/{command}',
        'help.details.module': 'Модуль',
        'help.details.access': 'Доступ',
        'help.details.more': 'Подробнее',

        // Search
        'search.title': '🎵 Результаты поиска для: **{query}**',
        'search.noResults': 'Нет результатов.',
        'search.pendingMissing': 'Нет активного поиска.',
        'search.cancelled': '❌ Поиск отменён',
        'search.invalidSelection': 'Некорректный выбор трека.',
        'search.trackAdded': '✅ **{title}** добавлен в очередь!',
        'search.queryExtractFailed': 'Не удалось получить запрос из сообщения.',
        'search.noResultsOn': 'Нет результатов на {platform}.',
        'search.error': 'Ошибка поиска.',
        'search.platformPlaceholder': 'Площадка: {platform}',
        'search.platformPlaceholderSelected': 'Выбранная площадка: {platform}',
        'search.platformDesc.youtube': 'Поиск видео на YouTube',
        'search.platformDesc.spotify': 'Поиск треков на Spotify',
        'search.platformDesc.soundcloud': 'Поиск на SoundCloud',
        'search.trackPlaceholder': 'Выберите трек',
        'search.changeLabel': 'Изменить поиск',
        'search.cancelLabel': 'Отмена',
        'search.modalTitle': 'Изменение запроса',
        'search.modalLabel': 'Введите запрос',
        'search.modalPlaceholder': 'Название трека, артиста, альбома...',

        // Music
        'music.play.failedCreate': 'Не удалось создать плеер.',
        'music.play.playlistAdded': 'Плейлист **{name}** добавлен! ({count} треков)',
        'music.play.trackEnqueued': '**{title}** добавлен в очередь!',
        'music.play.unknownPlaylist': 'Неизвестный плейлист',
        'music.play.searchPrompt': '🎵 Результаты поиска для: **{query}**',
        'music.play.errorLoading': 'Ошибка при загрузке трека.',
        'music.play.errorGeneric': 'Произошла ошибка при воспроизведении.',
        'music.play.sameChannel': 'Нужно быть в том же голосовом канале, что и бот.',
        'music.pause.done': 'Плеер поставлен на паузу.',
        'music.pause.already': 'Уже на паузе. Используй `/resume` чтобы продолжить.',
        'music.resume.done': 'Возобновил воспроизведение.',
        'music.resume.already': 'Уже играет.',
        'music.skip.done': '⏭️ Пропущен трек **{title}**.',
        'music.stop.noPlayer': 'Сейчас музыка не играет.',
        'music.stop.done': 'Музыка остановлена, соединение закрыто.',
        'music.shuffle.tooShort': 'Нужно минимум 2 трека в очереди, чтобы перемешать.',
        'music.shuffle.done': '🔀 Очередь перемешана. ({count} треков)',
        'music.loop.set.off': 'Режим повтора: выкл.',
        'music.loop.set.track': 'Режим повтора: трек.',
        'music.loop.set.queue': 'Режим повтора: очередь.',
        'music.seek.invalid': 'Укажи позицию в формате `1:30`, `90` или `1m30s`.',
        'music.seek.tooFar': 'Позиция больше длительности трека.',
        'music.seek.done': 'Перемотал на **{position}**.',
        'music.volume.current': 'Текущая громкость: **{value}%**',
        'music.volume.set': 'Громкость установлена на **{value}%**.',
        'music.queue.invalidPage': 'Неверная страница. Всего страниц: {pages}.',
        'music.queue.title': '📜 Очередь музыки',
        'music.queue.current': '🎶 Сейчас играет:',
        'music.queue.next': 'Далее:',
        'music.queue.empty': '*Очередь пуста*',
        'music.queue.loop.track': 'Повтор: трек',
        'music.queue.loop.queue': 'Повтор: очередь',
        'music.queue.loop.off': 'Повтор: выкл',
        'music.queue.footer': 'Стр. {page}/{pages} | {count} треков | Длительность: {duration}',
        'music.nowplaying.title': '🎶 Сейчас играет',
        'music.nowplaying.field.author': 'Автор',
        'music.nowplaying.field.progress': 'Прогресс',
        'music.nowplaying.field.volume': 'Громкость',
        'music.nowplaying.field.queue': 'Очередь',
        'music.nowplaying.field.loop': 'Повтор',
        'music.nowplaying.field.paused': 'Пауза',
        'music.nowplaying.loop.track': 'Трек',
        'music.nowplaying.loop.queue': 'Очередь',
        'music.nowplaying.loop.off': 'Выкл',
        'music.nowplaying.paused': 'Да',
        'music.nowplaying.queueCount': '{count} треков',
        'music.nowplaying.requester': 'Заказал',
        'music.player.field.volume': 'Громкость',
        'music.player.field.author': 'Автор',
        'music.player.field.duration': 'Длительность',
        'music.player.field.requester': 'Заказал',
        'music.player.field.loop': 'Повтор',
        'music.player.loop.off': 'Выкл',
        'music.player.loop.track': 'Трек',
        'music.player.loop.queue': 'Очередь',

        // Temp voice
        'tempvoice.enabled': [
            'Временные комнаты включены.',
            'Лобби: <#{hub}>',
            'Категория: {category}',
            'Шаблон имени: {template}',
            'Лимит пользователей: {limit}',
        ].join('\n'),
        'tempvoice.hubMustBeVoice': 'Лобби должно быть голосовым каналом.',
        'tempvoice.notManager': 'Нужно разрешение Manage Channels, чтобы настраивать временные комнаты.',
        'tempvoice.failedSave': 'Не удалось сохранить конфигурацию, попробуйте позже.',
        'tempvoice.statusMissing': 'Временные комнаты ещё не настроены.',
        'tempvoice.status': [
            'Лобби: <#{hub}>',
            'Категория: {category}',
            'Шаблон имени: {template}',
            'Лимит пользователей: {limit}',
        ].join('\n'),
        'tempvoice.disable.missing': 'Временные комнаты уже отключены.',
        'tempvoice.disable.done': 'Временные комнаты отключены, активные комнаты удалены.',
        'tempvoice.failedLoad': 'Не удалось загрузить конфигурацию.',
        'tempvoice.disable.failed': 'Не удалось отключить временные комнаты.',
        'tempvoice.unknownSubcommand': 'Неизвестная подкоманда.',

        // Setupv
        'setupv.guildOnly': 'Эту команду можно использовать только на сервере.',
        'setupv.notManager': 'Нужны права Manage Channels.',
        'setupv.summary': [
            'Создана система временных комнат:',
            'Категория: {category}',
            'Лобби: {hub}',
            'Канал управления: {panel}',
            'Шаблон имени: {template}',
            'Лимит пользователей: {limit}',
        ].join('\n'),
        'setupv.error': 'Не удалось настроить временные комнаты. Попробуйте позже.',
        'setupv.embed.title': 'Управление приватной комнатой',
        'setupv.embed.desc': [
            'Зайдите в лобби, чтобы создать комнату.',
            'Используйте кнопки ниже для управления:',
            '• 👑 Забрать комнату',
            '• ✅ Разрешить пользователя',
            '• 🚫 Заблокировать пользователя',
            '• 👥 Лимит пользователей',
            '• 🔒 Закрыть / открыть',
            '• ✏️ Переименовать',
            '• 🙈 Скрыть / показать',
            '• 👢 Кикнуть пользователя',
            '• 🎙️ Ограничить право говорить',
        ].join('\n'),

        // Interaction restrictions
        'interactions.musicChannelWhitelist': 'Нужно быть в разрешённом голосовом канале, чтобы использовать музыкальные команды.',
        'interactions.musicChannelBlacklist': 'Музыкальные команды запрещены в этом голосовом канале.',
        'interactions.djOnly': 'Включён DJ-режим. Нужна DJ-роль для музыкальных команд.',
        'interactions.playerNotReady': 'Плеер не готов.',
        'interactions.queueMissing': 'Для этого сервера нет очереди музыки.',
        'interactions.sameChannelRequired': 'Нужно быть в том же голосовом канале, что и бот.',
        'interactions.prevTrackMissing': 'Предыдущего трека нет.',
        'interactions.queueCheck': '**Очередь:**\n{tracks}',
        'interactions.queueTitle': 'Текущая очередь',
        'interactions.queueEmpty': 'Очередь пуста',
        'interactions.playFailed': 'Не удалось воспроизвести: {error}',

        // Voice interactions
        'voice.notInVoice': 'Зайдите в голосовой канал, чтобы управлять комнатой.',
        'voice.notTempRoom': 'Эта комната не управляется системой временных комнат.',
        'voice.ownerOnly.rename': 'Только владелец комнаты может менять имя.',
        'voice.ownerOnly.limit': 'Только владелец комнаты может менять лимит.',
        'voice.ownerOnly.lock': 'Только владелец комнаты может закрывать/открывать вход.',
        'voice.ownerOnly.kick': 'Только владелец комнаты может кикать пользователей.',
        'voice.ownerOnly.block': 'Только владелец комнаты может блокировать пользователей.',
        'voice.ownerOnly.permit': 'Только владелец комнаты может разрешать доступ.',
        'voice.ownerOnly.hide': 'Только владелец комнаты может скрывать или показывать её.',
        'voice.ownerOnly.speak': 'Только владелец комнаты может ограничивать право говорить.',
        'voice.ownerOnly.panel': 'Только владелец комнаты может использовать эту панель.',
        'voice.modal.rename.title': 'Переименовать комнату',
        'voice.modal.rename.label': 'Новое имя',
        'voice.modal.limit.title': 'Задать лимит',
        'voice.modal.limit.label': 'Максимум участников (0-99)',
        'voice.modal.limit.placeholder': 'Например: 8',
        'voice.select.limit.placeholder': 'Выберите лимит',
        'voice.select.limit.custom': 'Свое значение...',
        'voice.select.limit.none': 'Без лимита',
        'voice.select.limit.prompt': 'Выберите лимит пользователей для комнаты:',
        'voice.select.kick.placeholder': 'Выберите кого кикнуть',
        'voice.select.kick.prompt': 'Кого кикнуть из комнаты?',
        'voice.select.kick.empty': 'Некого кикать — в комнате только вы.',
        'voice.select.block.prompt': 'Выберите пользователей для блокировки',
        'voice.select.permit.prompt': 'Выберите пользователей для разрешения',
        'voice.rename.empty': 'Имя не может быть пустым.',
        'voice.rename.updated': 'Название обновлено на **{name}**.',
        'voice.limit.invalid': 'Введите число от 0 до 99.',
        'voice.limit.updated': 'Лимит обновлён: {limit}.',
        'voice.kick.done': 'Кикнуто пользователей: {count}.',
        'voice.kick.none': 'Не удалось кикнуть пользователей.',
        'voice.block.updated': 'Доступ обновлён: пользователи заблокированы.',
        'voice.permit.updated': 'Доступ обновлён: пользователи разрешены.',
        'voice.locked': 'Комната закрыта (только разрешённые пользователи).',
        'voice.unlocked': 'Комната открыта.',
        'voice.claim.alreadyOwner': 'Вы уже владелец этой комнаты.',
        'voice.claim.ownerInside': 'Текущий владелец ещё в комнате. Забрать нельзя.',
        'voice.claim.success': 'Вы стали владельцем комнаты.',
        'voice.hide.shown': 'Комната показана всем.',
        'voice.hide.hidden': 'Комната скрыта от всех.',
        'voice.speak.allowed': 'Разрешено говорить всем.',
        'voice.speak.restricted': 'Право говорить ограничено.',
    },
};

type TranslationKey = keyof typeof translations.en;

const localeCache = new Map<string, { locale: LocaleCode; expires: number }>();

const isLocale = (value: string | null | undefined): value is LocaleCode =>
    value === 'ru' || value === 'en';

const normalizeLocale = (value: string | null | undefined): LocaleCode =>
    isLocale(value) ? value : DEFAULT_LOCALE;

const format = (template: string, vars?: Record<string, string | number>) => {
    if (!vars) return template;
    return template.replace(/\{(\w+)\}/g, (_match, key) => {
        const value = vars[key];
        return value === undefined || value === null ? '' : String(value);
    });
};

export async function getGuildLocale(guildId?: string | null): Promise<LocaleCode> {
    if (!guildId) return DEFAULT_LOCALE;
    const cached = localeCache.get(guildId);
    const now = Date.now();
    if (cached && cached.expires > now) {
        return cached.locale;
    }

    try {
        const settings = await prisma.botSettings.findUnique({
            where: { guildId },
            select: { locale: true }
        });
        const locale = normalizeLocale(settings?.locale);
        localeCache.set(guildId, { locale, expires: now + LOCALE_TTL_MS });
        return locale;
    } catch {
        return DEFAULT_LOCALE;
    }
}

export const getInteractionLocale = (interaction: Interaction | ChatInputCommandInteraction) =>
    getGuildLocale('guildId' in interaction ? interaction.guildId : null);

export function t(locale: LocaleCode, key: TranslationKey, vars?: Record<string, string | number>) {
    const lang = translations[locale] ?? translations[DEFAULT_LOCALE];
    const template = lang[key] ?? translations[DEFAULT_LOCALE][key] ?? key;
    return format(template, vars);
}

export function availableLocales() {
    return [
        { code: 'ru', label: 'Русский' },
        { code: 'en', label: 'English' },
    ] as const;
}
