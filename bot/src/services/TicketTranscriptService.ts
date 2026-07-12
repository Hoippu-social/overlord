import { Client, Message, TextBasedChannel } from 'discord.js';
import { prisma } from '../utils/database';
import logger from '../utils/logger';

const MAX_MESSAGES = 2000;
const PAGE_SIZE = 100;

// ─── HTML generation ─────────────────────────────────────────────────────────

function escapeHtml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function renderMarkdownLite(text: string): string {
    return escapeHtml(text)
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/`(.+?)`/g, '<code>$1</code>')
        .replace(/\|\|(.+?)\|\|/g, '<span class="spoiler">$1</span>')
        .replace(/\n/g, '<br>');
}

function formatTimestamp(date: Date): string {
    return date.toLocaleString('ru-RU', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        timeZoneName: 'short',
    });
}

function buildTranscriptHtml(messages: Message[], meta: {
    ticketNumber: number;
    guildName: string;
    categoryName: string;
    authorId: string;
    closedAt: Date;
    dashboardUrl?: string;
}): string {
    const rows = messages.map((msg) => {
        const author = msg.member?.displayName ?? msg.author.username;
        const avatar = msg.author.displayAvatarURL({ size: 32 }) || '';
        const timestamp = formatTimestamp(msg.createdAt);
        const isBot = msg.author.bot;

        const attachmentLinks = msg.attachments
            .map((a) => `<a href="${escapeHtml(a.url)}" target="_blank">${escapeHtml(a.name ?? 'attachment')}</a>`)
            .join(' ');

        const embedRows = msg.embeds.map((e) => {
            const title = e.title ? `<div class="embed-title">${escapeHtml(e.title)}</div>` : '';
            const desc = e.description ? `<div class="embed-desc">${renderMarkdownLite(e.description)}</div>` : '';
            const color = e.color ? `border-left: 3px solid #${e.color.toString(16).padStart(6, '0')}` : '';
            return `<div class="embed" style="${color}">${title}${desc}</div>`;
        }).join('');

        return `
            <div class="message${isBot ? ' bot' : ''}">
                <img class="avatar" src="${escapeHtml(avatar)}" alt="" loading="lazy">
                <div class="content">
                    <span class="author">${escapeHtml(author)}</span>
                    <span class="timestamp">${escapeHtml(timestamp)}</span>
                    <div class="text">${renderMarkdownLite(msg.content)}</div>
                    ${attachmentLinks ? `<div class="attachments">${attachmentLinks}</div>` : ''}
                    ${embedRows}
                </div>
            </div>`;
    }).join('\n');

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Ticket #${meta.ticketNumber} — ${escapeHtml(meta.guildName)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #313338; color: #dbdee1; font-family: 'Whitney', 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 14px; }
  .header { background: #1e1f22; padding: 16px 24px; display: flex; align-items: center; gap: 12px; }
  .header h1 { font-size: 18px; font-weight: 700; color: #fff; }
  .header .meta { font-size: 12px; color: #949ba4; }
  .messages { max-width: 900px; margin: 0 auto; padding: 16px; }
  .message { display: flex; gap: 12px; padding: 4px 0; }
  .avatar { width: 32px; height: 32px; border-radius: 50%; flex-shrink: 0; margin-top: 2px; }
  .content { flex: 1; min-width: 0; }
  .author { font-weight: 600; color: #fff; margin-right: 8px; }
  .bot .author::after { content: 'BOT'; font-size: 10px; background: #5865f2; color: #fff; border-radius: 3px; padding: 1px 4px; margin-left: 4px; }
  .timestamp { font-size: 11px; color: #949ba4; }
  .text { word-break: break-word; }
  .text:empty { display: none; }
  .attachments { margin-top: 4px; font-size: 12px; }
  .attachments a { color: #00aff4; }
  .embed { background: #2b2d31; border-radius: 4px; padding: 8px 12px; margin-top: 4px; }
  .embed-title { font-weight: 700; margin-bottom: 4px; }
  .embed-desc { color: #dbdee1; }
  .spoiler { background: #202225; color: transparent; cursor: pointer; border-radius: 3px; padding: 0 2px; }
  .spoiler:hover { color: inherit; background: #36393f; }
  code { background: #1e1f22; border-radius: 3px; padding: 1px 4px; font-family: Consolas, monospace; }
</style>
</head>
<body>
<div class="header">
  <div>
    <h1>Ticket #${meta.ticketNumber}</h1>
    <div class="meta">${escapeHtml(meta.guildName)} &bull; ${escapeHtml(meta.categoryName)} &bull; Closed ${escapeHtml(formatTimestamp(meta.closedAt))}</div>
  </div>
</div>
<div class="messages">${rows}</div>
</body>
</html>`;
}

// ─── Fetch from Discord ───────────────────────────────────────────────────────

async function fetchAllMessages(channel: TextBasedChannel): Promise<Message[]> {
    const messages: Message[] = [];
    let lastId: string | undefined;

    while (messages.length < MAX_MESSAGES) {
        const batch = await channel.messages.fetch({
            limit: PAGE_SIZE,
            ...(lastId ? { before: lastId } : {}),
        });

        if (batch.size === 0) break;

        for (const msg of batch.values()) {
            messages.push(msg);
        }

        lastId = batch.last()?.id;
        if (batch.size < PAGE_SIZE) break;
    }

    return messages.reverse();
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function generateTranscript(
    client: Client,
    ticketId: number,
    dashboardUrl?: string,
): Promise<string | null> {
    const ticket = await prisma.ticket.findUnique({
        where: { id: ticketId },
        include: {
            guild: { select: { name: true } },
            category: { select: { name: true } },
        },
    });

    if (!ticket) return null;

    try {
        const guild = client.guilds.cache.get(ticket.guildId) ?? await client.guilds.fetch(ticket.guildId).catch(() => null);
        if (!guild) return null;

        const channel = await guild.channels.fetch(ticket.threadId).catch(() => null);
        if (!channel || !('messages' in channel)) return null;

        const messages = await fetchAllMessages(channel as TextBasedChannel);

        const html = buildTranscriptHtml(messages, {
            ticketNumber: ticket.number,
            guildName: ticket.guild?.name ?? 'Unknown Server',
            categoryName: ticket.category?.name ?? 'Unknown',
            authorId: ticket.authorId,
            closedAt: ticket.closedAt ?? new Date(),
            dashboardUrl,
        });

        await prisma.ticket.update({
            where: { id: ticketId },
            data: { transcript: html },
        });

        return html;
    } catch (err) {
        logger.warn(`[TicketTranscriptService] Failed to generate transcript for ticket ${ticketId}:`, err);
        return null;
    }
}

export async function generateTranscriptBeforeClose(
    client: Client,
    ticketId: number,
    dashboardUrl?: string,
): Promise<string | null> {
    return generateTranscript(client, ticketId, dashboardUrl);
}
