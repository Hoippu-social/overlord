const assert = require('assert');
const fs = require('fs');
const path = require('path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '../..');

test('bot ticket bridge exposes priority transfer and note endpoints', () => {
    const source = fs.readFileSync(path.resolve(repoRoot, 'bot/src/utils/dashboardApi.ts'), 'utf8');

    assert.match(source, /\/api\/tickets\/priority/);
    assert.match(source, /\/api\/tickets\/transfer/);
    assert.match(source, /\/api\/tickets\/transfer\/resolve/);
    assert.match(source, /\/api\/tickets\/note/);
    assert.match(source, /\/api\/tickets\/preview-panel/);
    assert.match(source, /postTransferRequestPrompt/);
    assert.match(source, /applyTransferThreadAccess/);
});

test('bot Discord ticket interactions handle transfer buttons', () => {
    const source = fs.readFileSync(path.resolve(repoRoot, 'bot/src/services/TicketInteractionService.ts'), 'utf8');

    assert.match(source, /tk_transfer_accept/);
    assert.match(source, /tk_transfer_decline/);
    assert.match(source, /handleTransferResolve/);
    assert.match(source, /resolveTransferRequest/);
});

test('bot ticket panel renderer supports components v2 and locked opener buttons', () => {
    const schema = fs.readFileSync(path.resolve(repoRoot, 'bot/prisma/schema.prisma'), 'utf8');
    const renderer = fs.readFileSync(path.resolve(repoRoot, 'bot/src/services/TicketPanelMessageDesign.ts'), 'utf8');
    const panelService = fs.readFileSync(path.resolve(repoRoot, 'bot/src/services/TicketPanelService.ts'), 'utf8');

    assert.match(schema, /messageDesignJson\s+String\?/);
    assert.match(renderer, /MessageFlags\.IsComponentsV2/);
    assert.match(renderer, /mode: 'classic_embed'/);
    assert.match(renderer, /mode: 'components_v2'/);
    assert.match(renderer, /setCustomId\(`tk_open:\$\{categoryId\}`\)/);
    assert.match(panelService, /buildTicketPanelPayload/);
    assert.match(panelService, /sendTicketPanelPreview/);
    assert.match(panelService, /content: null/);
});
