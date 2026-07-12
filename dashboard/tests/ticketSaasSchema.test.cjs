const assert = require('assert');
const fs = require('fs');
const path = require('path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '../..');

test('dashboard ticket SaaS schema exposes priority, transfer, notes, and access profiles', () => {
    const schema = fs.readFileSync(path.resolve(repoRoot, 'dashboard/prisma/schema.prisma'), 'utf8');

    assert.match(schema, /model TicketPriority/);
    assert.match(schema, /model TicketAccessProfile/);
    assert.match(schema, /model TicketTransferRequest/);
    assert.match(schema, /model TicketInternalNote/);
    assert.match(schema, /model TicketCategoryRoutingRule/);
    assert.match(schema, /messageDesignJson\s+String\?/);
    assert.match(schema, /responsibleUserId\s+String\?/);
    assert.match(schema, /transferState\s+String\s+@default\("NONE"\)/);
    assert.match(schema, /priority\s+TicketPriority\?\s+@relation/);
});

test('dashboard ticket routes expose SaaS operations', () => {
    const actionRoute = fs.readFileSync(
        path.resolve(repoRoot, 'dashboard/src/app/api/guilds/[guildId]/tickets/items/[ticketId]/action/route.ts'),
        'utf8'
    );
    const listRoute = fs.readFileSync(
        path.resolve(repoRoot, 'dashboard/src/app/api/guilds/[guildId]/tickets/list/route.ts'),
        'utf8'
    );
    const notificationsRoute = fs.readFileSync(
        path.resolve(repoRoot, 'dashboard/src/app/api/guilds/[guildId]/tickets/notifications/route.ts'),
        'utf8'
    );

    assert.match(actionRoute, /transfer_accept/);
    assert.match(actionRoute, /transfer_decline/);
    assert.match(actionRoute, /priority/);
    assert.match(actionRoute, /note/);
    assert.match(actionRoute, /authorizeTicketRequest/);
    assert.match(listRoute, /responsibleUserId/);
    assert.match(listRoute, /transferState/);
    assert.match(listRoute, /priority/);
    assert.match(notificationsRoute, /tickets\.config/);
    assert.match(notificationsRoute, /ticketNotificationRule/);
    assert.match(notificationsRoute, /targetRoleIds:\s*normalizeJsonArray/);
});

test('dashboard ticket panel message design supports classic, components v2, and preview send', () => {
    const schema = fs.readFileSync(path.resolve(repoRoot, 'dashboard/prisma/schema.prisma'), 'utf8');
    const messageDesign = fs.readFileSync(
        path.resolve(repoRoot, 'dashboard/src/lib/tickets/messageDesign.ts'),
        'utf8'
    );
    const categoryRoute = fs.readFileSync(
        path.resolve(repoRoot, 'dashboard/src/app/api/guilds/[guildId]/tickets/[categoryId]/route.ts'),
        'utf8'
    );
    const previewRoute = fs.readFileSync(
        path.resolve(repoRoot, 'dashboard/src/app/api/guilds/[guildId]/tickets/[categoryId]/preview/route.ts'),
        'utf8'
    );

    assert.match(schema, /messageDesignJson\s+String\?/);
    assert.match(messageDesign, /mode: 'classic_embed'/);
    assert.match(messageDesign, /mode: 'components_v2'/);
    assert.match(messageDesign, /COMPONENTS_V2_FLAG = 1 << 15/);
    assert.match(messageDesign, /legacyFieldsFromDesign/);
    assert.match(messageDesign, /validateTicketPanelMessageDesign/);
    assert.match(categoryRoute, /messageDesignJson/);
    assert.match(previewRoute, /\/api\/tickets\/preview-panel/);
});
