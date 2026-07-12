import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { authorizeGuildApiRequest, isGuildApiAuthFailure } from '@/lib/guildApiAuth';
import { resolveTicketPermissions } from '@/lib/discordAccess';

export type TicketPermission =
    | 'tickets.view'
    | 'tickets.reply'
    | 'tickets.manage'
    | 'tickets.assign'
    | 'tickets.transfer'
    | 'tickets.note'
    | 'tickets.config';

export type TicketAuthSuccess = {
    accessToken: string;
    token: unknown;
    actorId: string;
    permissions: Set<string>;
};

export type TicketAuthResult = TicketAuthSuccess | { response: NextResponse };

export function isTicketAuthFailure(result: TicketAuthResult): result is { response: NextResponse } {
    return 'response' in result;
}

export async function authorizeTicketRequest(
    request: NextRequest,
    guildId: string,
    permission: TicketPermission,
    options: { live?: boolean } = {}
): Promise<TicketAuthResult> {
    const auth = await authorizeGuildApiRequest(request, guildId, options);
    if (isGuildApiAuthFailure(auth)) {
        return auth;
    }

    const permissions = await resolveTicketPermissions(auth.accessToken, guildId, { forceRefresh: options.live });
    const hasPermission = permissions.has('*') || permissions.has(permission) || permissions.has('tickets.manage');
    if (!hasPermission) {
        return {
            response: NextResponse.json({ error: 'Forbidden', code: 'ticket_permission_denied' }, { status: 403 }),
        };
    }

    const token = auth.token as { sub?: unknown };
    const actorId = typeof token.sub === 'string' && token.sub.trim().length
        ? token.sub
        : 'dashboard-admin';

    return { ...auth, actorId, permissions };
}
