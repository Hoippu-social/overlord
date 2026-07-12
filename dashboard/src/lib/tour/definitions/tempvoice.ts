import type { TourDefinition } from '../types';

export const tempvoiceTour: TourDefinition = {
    id: 'tempvoice',
    match: (ctx) => ctx.path === 'tempvoice',
    steps: [
        {
            id: 'tempvoice-header-actions',
            anchor: '[data-tour="tempvoice-header-actions"]',
            placement: 'bottom',
            title: { ru: 'Статус и сохранение', en: 'Status & save' },
            body: {
                ru: 'Текущий статус настройки и сохранение изменений.',
                en: 'Current setup status and saving changes.',
            },
        },
        {
            id: 'tempvoice-infrastructure',
            anchor: '[data-tour="tempvoice-infrastructure"]',
            placement: 'right',
            title: { ru: 'Инфраструктура', en: 'Infrastructure' },
            body: {
                ru: 'Категория и хаб-канал, через которые создаются временные войс-комнаты.',
                en: 'The category and hub channel used to spin up temporary voice rooms.',
            },
        },
        {
            id: 'tempvoice-mode',
            anchor: '[data-tour="tempvoice-mode"]',
            placement: 'bottom',
            title: { ru: 'Режим настройки', en: 'Setup mode' },
            body: {
                ru: 'Создать новую категорию/канал или использовать уже существующие.',
                en: 'Create a new category/channel or reuse existing ones.',
            },
        },
        {
            id: 'tempvoice-room-settings',
            anchor: '[data-tour="tempvoice-room-settings"]',
            placement: 'right',
            title: { ru: 'Настройки комнат', en: 'Room settings' },
            body: {
                ru: 'Шаблон имени комнаты и лимит участников по умолчанию.',
                en: 'Room name template and the default member limit.',
            },
        },
        {
            id: 'tempvoice-status',
            anchor: '[data-tour="tempvoice-status"]',
            placement: 'left',
            title: { ru: 'Статус системы', en: 'System status' },
            body: {
                ru: 'Число активных комнат и статус подключения хаба и интерфейса.',
                en: 'Active room count and hub/interface connection status.',
            },
        },
    ],
};
