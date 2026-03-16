import { Client, Guild, Invite } from 'discord.js';
import logger from './logger';
import { prisma, statsPrisma } from './database';

const inviteCache = new Map<string, Map<string, number>>();

function setCache(guildId: string, invites: Map<string, number>) {
    inviteCache.set(guildId, invites);
}

function getCache(guildId: string) {
    return inviteCache.get(guildId);
}

async function fetchInvites(guild: Guild) {
    try {
        return await guild.invites.fetch();
    } catch (error) {
        logger.warn(`[Invites] Failed to fetch invites for guild ${guild.id}: ${error}`);
        return null;
    }
}

async function persistSnapshots(guildId: string, invites: Map<string, Invite>) {
    for (const invite of invites.values()) {
        const code = invite.code;
        const inviterId = invite.inviter?.id ?? null;
        const uses = invite.uses ?? 0;

        try {
            await statsPrisma.inviteSnapshot.upsert({
                where: { guildId_code: { guildId, code } },
                update: {
                    inviterId,
                    uses,
                    maxUses: invite.maxUses ?? null,
                    expiresAt: invite.expiresAt ?? null,
                },
                create: {
                    guildId,
                    code,
                    inviterId,
                    uses,
                    maxUses: invite.maxUses ?? null,
                    expiresAt: invite.expiresAt ?? null,
                },
            });
        } catch (error) {
            logger.warn(`[Invites] Failed to upsert snapshot ${guildId}/${code}: ${error}`);
        }
    }
}

function buildUsesMap(invites: Map<string, Invite>) {
    const map = new Map<string, number>();
    for (const invite of invites.values()) {
        map.set(invite.code, invite.uses ?? 0);
    }
    return map;
}

function findUsedInvite(prev: Map<string, number> | undefined, current: Map<string, Invite>) {
    let best: Invite | null = null;
    let bestDiff = 0;

    for (const invite of current.values()) {
        const prevUses = prev?.get(invite.code) ?? 0;
        const currentUses = invite.uses ?? 0;
        const diff = currentUses - prevUses;
        if (diff > bestDiff) {
            bestDiff = diff;
            best = invite;
        }
    }

    return best;
}

export async function primeInviteCache(client: Client) {
    for (const guild of client.guilds.cache.values()) {
        const invites = await fetchInvites(guild);
        if (!invites) continue;

        await persistSnapshots(guild.id, invites);
        setCache(guild.id, buildUsesMap(invites));
    }
}

export async function handleInviteCreate(invite: Invite) {
    const guildId = invite.guild?.id;
    if (!guildId) return;

    const cache = getCache(guildId) ?? new Map<string, number>();
    cache.set(invite.code, invite.uses ?? 0);
    setCache(guildId, cache);

    try {
        await statsPrisma.inviteSnapshot.upsert({
            where: { guildId_code: { guildId, code: invite.code } },
            update: {
                inviterId: invite.inviter?.id ?? null,
                uses: invite.uses ?? 0,
                maxUses: invite.maxUses ?? null,
                expiresAt: invite.expiresAt ?? null,
            },
            create: {
                guildId,
                code: invite.code,
                inviterId: invite.inviter?.id ?? null,
                uses: invite.uses ?? 0,
                maxUses: invite.maxUses ?? null,
                expiresAt: invite.expiresAt ?? null,
            },
        });
    } catch (error) {
        logger.warn(`[Invites] Failed to save invite create ${guildId}/${invite.code}: ${error}`);
    }
}

export async function handleInviteDelete(invite: Invite) {
    const guildId = invite.guild?.id;
    if (!guildId) return;

    const cache = getCache(guildId);
    cache?.delete(invite.code);

    try {
        await statsPrisma.inviteSnapshot.delete({
            where: { guildId_code: { guildId, code: invite.code } },
        });
    } catch (error) {
        logger.warn(`[Invites] Failed to delete invite snapshot ${guildId}/${invite.code}: ${error}`);
    }
}

export async function getInviteAttribution(guild: Guild) {
    const previous = getCache(guild.id);
    if (!previous) {
        const invites = await fetchInvites(guild);
        if (invites) {
            await persistSnapshots(guild.id, invites);
            setCache(guild.id, buildUsesMap(invites));
        }
    }

    const invites = await fetchInvites(guild);
    if (!invites) {
        return {
            code: guild.vanityURLCode ? 'vanity' : null,
            inviterId: null,
        };
    }

    const usedInvite = findUsedInvite(previous, invites);
    await persistSnapshots(guild.id, invites);
    setCache(guild.id, buildUsesMap(invites));

    if (usedInvite) {
        return {
            code: usedInvite.code,
            inviterId: usedInvite.inviter?.id ?? null,
        };
    }

    return {
        code: guild.vanityURLCode ? 'vanity' : null,
        inviterId: null,
    };
}

export async function addVoiceDuration(guildId: string, memberId: string, durationSec: number) {
    if (!durationSec || durationSec <= 0) return;

    const existing = await statsPrisma.inviteUseEvent.findFirst({
        where: {
            guildId,
            memberId,
            leftAt: null,
        },
        orderBy: { joinedAt: 'desc' },
    });

    if (!existing) return;

    const current = existing.voiceDurationSec ?? 0;
    try {
        await statsPrisma.inviteUseEvent.update({
            where: { id: existing.id },
            data: { voiceDurationSec: current + Math.floor(durationSec) },
        });
    } catch (error) {
        logger.warn(`[Invites] Failed to update voice duration for ${guildId}/${memberId}: ${error}`);
    }
}
