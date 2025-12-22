import { Events, Invite } from 'discord.js';
import { handleInviteDelete } from '../utils/inviteTracker';
import { logAuditEvent } from '../utils/auditLog';

export default {
    name: Events.InviteDelete,
    once: false,
    async execute(invite: Invite) {
        if (!invite.guild?.id) return;

        await handleInviteDelete(invite);

        await logAuditEvent(invite.client, {
            guildId: invite.guild.id,
            tag: 'invites',
            actorId: invite.inviter?.id ?? null,
            channelId: invite.channelId ?? null,
            payload: {
                event: 'invite_delete',
                code: invite.code,
            },
            severity: 'INFO',
        });
    },
};
