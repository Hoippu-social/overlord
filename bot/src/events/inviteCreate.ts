import { Events, Invite } from 'discord.js';
import { handleInviteCreate } from '../utils/inviteTracker';
import { logAuditEvent } from '../utils/auditLog';

export default {
    name: Events.InviteCreate,
    once: false,
    async execute(invite: Invite) {
        if (!invite.guild?.id) return;

        await handleInviteCreate(invite);

        await logAuditEvent(invite.client, {
            guildId: invite.guild.id,
            tag: 'invites',
            actorId: invite.inviter?.id ?? null,
            channelId: invite.channelId ?? null,
            payload: {
                event: 'invite_create',
                code: invite.code,
                maxUses: invite.maxUses ?? null,
                expiresAt: invite.expiresAt ?? null,
            },
            severity: 'INFO',
        });
    },
};
