import type { TourDefinition } from '../types';

export const ticketsTours: TourDefinition[] = [
    {
        id: 'tickets-workspace',
        match: (ctx) => ctx.path === 'tickets',
        steps: [
            {
                id: 'tickets-tabs',
                anchor: '[data-tour="tickets-tabs"]',
                placement: 'bottom',
                title: { ru: 'Разделы тикетов', en: 'Ticket sections' },
                body: {
                    ru: 'Обзор, входящие, категории, приоритеты, уведомления и доступ.',
                    en: 'Overview, inbox, categories, priorities, notifications and access.',
                },
            },
            {
                id: 'tickets-overview',
                anchor: '[data-tour="tickets-overview"]',
                placement: 'top',
                title: { ru: 'Обзор тикетов', en: 'Tickets overview' },
                body: {
                    ru: 'KPI, SLA, очереди и нагрузка на команду поддержки.',
                    en: 'KPIs, SLA, queues and support team load.',
                },
            },
            {
                id: 'tickets-inbox',
                anchor: '[data-tour="tickets-inbox"]',
                placement: 'top',
                title: { ru: 'Входящие', en: 'Inbox' },
                body: {
                    ru: 'Список тикетов с фильтрами — откройте любой, чтобы ответить.',
                    en: 'The ticket list with filters — open one to respond.',
                },
            },
            {
                id: 'tickets-categories',
                anchor: '[data-tour="tickets-categories"]',
                placement: 'top',
                title: { ru: 'Категории', en: 'Categories' },
                body: {
                    ru: 'Типы тикетов и их настройки по умолчанию.',
                    en: 'Ticket types and their default settings.',
                },
            },
            {
                id: 'tickets-priorities',
                anchor: '[data-tour="tickets-priorities"]',
                placement: 'top',
                title: { ru: 'Приоритеты', en: 'Priorities' },
                body: {
                    ru: 'Уровни приоритета и связанные с ними роли.',
                    en: 'Priority levels and their associated roles.',
                },
            },
            {
                id: 'tickets-notifications',
                anchor: '[data-tour="tickets-notifications"]',
                placement: 'top',
                title: { ru: 'Уведомления', en: 'Notifications' },
                body: {
                    ru: 'Правила оповещений по категориям и приоритетам тикетов.',
                    en: 'Notification rules by ticket category and priority.',
                },
            },
            {
                id: 'tickets-access',
                anchor: '[data-tour="tickets-access"]',
                placement: 'top',
                title: { ru: 'Доступ', en: 'Access' },
                body: {
                    ru: 'Какие роли могут видеть и обрабатывать тикеты.',
                    en: 'Which roles can see and handle tickets.',
                },
            },
        ],
    },
    {
        id: 'tickets-live',
        match: (ctx) => ctx.path === 'tickets/live',
        steps: [
            {
                id: 'tickets-live-filter',
                anchor: '[data-tour="tickets-live-filter"]',
                placement: 'bottom',
                title: { ru: 'Фильтр по статусу', en: 'Status filter' },
                body: {
                    ru: 'Отфильтруйте активные тикеты по статусу.',
                    en: 'Filter active tickets by status.',
                },
            },
            {
                id: 'tickets-live-table',
                anchor: '[data-tour="tickets-live-table"]',
                placement: 'top',
                title: { ru: 'Активные тикеты', en: 'Live tickets' },
                body: {
                    ru: 'Все открытые тикеты в реальном времени с приоритетом и ответственным.',
                    en: 'All open tickets in real time with priority and assignee.',
                },
            },
        ],
    },
    {
        id: 'tickets-transcripts',
        match: (ctx) => ctx.path === 'tickets/transcripts',
        steps: [
            {
                id: 'tickets-transcripts-table',
                anchor: '[data-tour="tickets-transcripts-table"]',
                placement: 'top',
                title: { ru: 'Транскрипты', en: 'Transcripts' },
                body: {
                    ru: 'Архив закрытых тикетов с полной историей переписки.',
                    en: 'An archive of closed tickets with their full conversation history.',
                },
            },
        ],
    },
];
