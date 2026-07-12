import type { TourDefinition } from '../types';

export const auditTour: TourDefinition = {
    id: 'audit',
    match: (ctx) => ctx.path === 'audit',
    steps: [
        {
            id: 'audit-add-route',
            anchor: '[data-tour="audit-add-route"]',
            placement: 'right',
            title: { ru: 'Новый маршрут', en: 'New route' },
            body: {
                ru: 'Свяжите тип события с каналом, куда бот будет присылать логи.',
                en: 'Link an event type to a channel where the bot posts logs.',
            },
        },
        {
            id: 'audit-routes-list',
            anchor: '[data-tour="audit-routes-list"]',
            placement: 'right',
            title: { ru: 'Активные маршруты', en: 'Active routes' },
            body: {
                ru: 'Список настроенных маршрутов логирования — включайте, отключайте или удаляйте их.',
                en: 'Configured log routes — enable, disable or delete them here.',
            },
        },
        {
            id: 'audit-feed',
            anchor: '[data-tour="audit-feed"]',
            placement: 'left',
            title: { ru: 'Лента событий', en: 'Events feed' },
            body: {
                ru: 'Живая лента всех произошедших на сервере событий.',
                en: 'A live feed of everything happening on the server.',
            },
        },
    ],
};
