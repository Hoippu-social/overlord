import type { TourContext, TourDefinition } from './types';
import { hubTour } from './definitions/hub';
import { statsTours } from './definitions/stats';
import { moderationTours } from './definitions/moderation';
import { commandsTour } from './definitions/commands';
import { auditTour } from './definitions/audit';
import { economyTour } from './definitions/economy';
import { musicTour } from './definitions/music';
import { tempvoiceTour } from './definitions/tempvoice';
import { ticketsTours } from './definitions/tickets';
import { serverSettingsTour } from './definitions/serverSettings';

const ALL_TOURS: TourDefinition[] = [
    ...statsTours,
    ...moderationTours,
    ...ticketsTours,
    economyTour,
    musicTour,
    tempvoiceTour,
    commandsTour,
    auditTour,
    serverSettingsTour,
    hubTour,
];

export const resolveTour = (pathname: string, searchParams: URLSearchParams): TourDefinition | null => {
    const match = pathname.match(/\/dashboard\/[^/]+(\/.*)?$/);
    const rawPath = match ? (match[1] ?? '') : pathname;
    const path = rawPath.replace(/^\/+/, '').replace(/\/+$/, '');
    const ctx: TourContext = { path, searchParams };

    for (const tour of ALL_TOURS) {
        if (tour.match(ctx)) {
            return tour;
        }
    }

    return null;
};
