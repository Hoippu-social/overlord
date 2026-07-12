import type { TourDefinition } from '../types';

export const economyTour: TourDefinition = {
    id: 'economy',
    match: (ctx) => ctx.path === 'economy',
    steps: [
        {
            id: 'economy-tabs',
            anchor: '[data-tour="economy-tabs"]',
            placement: 'bottom',
            title: { ru: 'Разделы экономики', en: 'Economy sections' },
            body: {
                ru: 'Обзор, кошельки, заработок, магазин, роли, квесты, события, журнал и конфигурация.',
                en: 'Overview, wallets, earn sources, shop, roles, quests, events, ledger and config.',
            },
        },
        {
            id: 'economy-overview',
            anchor: '[data-tour="economy-overview"]',
            placement: 'top',
            title: { ru: 'Обзор экономики', en: 'Economy overview' },
            body: {
                ru: 'Денежная масса, эмиссия, сжигание и источники за выбранный период.',
                en: 'Money supply, emission, sinks and sources over the selected period.',
            },
        },
        {
            id: 'economy-wallets',
            anchor: '[data-tour="economy-wallets"]',
            placement: 'top',
            title: { ru: 'Кошельки', en: 'Wallets' },
            body: {
                ru: 'Баланс каждого участника — выдавайте, списывайте или заносите в чёрный список.',
                en: 'Every member’s balance — grant, deduct, or blacklist from here.',
            },
        },
        {
            id: 'economy-earn',
            anchor: '[data-tour="economy-earn"]',
            placement: 'top',
            title: { ru: 'Источники заработка', en: 'Earn sources' },
            body: {
                ru: 'Настройте, как участники зарабатывают валюту на сервере.',
                en: 'Configure how members earn currency on the server.',
            },
        },
        {
            id: 'economy-shop',
            anchor: '[data-tour="economy-shop"]',
            placement: 'top',
            title: { ru: 'Магазин', en: 'Shop' },
            body: {
                ru: 'Товары и роли, которые участники могут купить за валюту.',
                en: 'Items and roles members can purchase with currency.',
            },
        },
        {
            id: 'economy-roles',
            anchor: '[data-tour="economy-roles"]',
            placement: 'top',
            title: { ru: 'Роли и штрафы', en: 'Roles & fines' },
            body: {
                ru: 'Связи между ролями и экономикой: бонусы и штрафные действия.',
                en: 'Role-based economy links: bonuses and fine actions.',
            },
        },
        {
            id: 'economy-quests',
            anchor: '[data-tour="economy-quests"]',
            placement: 'top',
            title: { ru: 'Квесты', en: 'Quests' },
            body: {
                ru: 'Задания с наградами, которые выполняют участники сервера.',
                en: 'Reward-bearing tasks members complete on the server.',
            },
        },
        {
            id: 'economy-events',
            anchor: '[data-tour="economy-events"]',
            placement: 'top',
            title: { ru: 'События', en: 'Events' },
            body: {
                ru: 'Временные экономические события — бусты, распродажи и акции.',
                en: 'Temporary economy events — boosts, sales and promotions.',
            },
        },
        {
            id: 'economy-ledger',
            anchor: '[data-tour="economy-ledger"]',
            placement: 'top',
            title: { ru: 'Журнал операций', en: 'Ledger' },
            body: {
                ru: 'История всех транзакций в экономике сервера.',
                en: 'History of every transaction in the server economy.',
            },
        },
        {
            id: 'economy-config',
            anchor: '[data-tour="economy-config"]',
            placement: 'top',
            title: { ru: 'Конфигурация', en: 'Config' },
            body: {
                ru: 'Включение экономики, валюта и общие параметры модуля.',
                en: 'Enable the economy, currency name and general module settings.',
            },
        },
    ],
};
