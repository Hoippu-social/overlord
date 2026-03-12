import fs from 'fs';

async function testStats(guildId: string) {
    const API_BASE = 'http://127.0.0.1:3001/api/guilds/' + guildId;

    console.log('--- TEST 1: SYNC ENDPOINT ---');
    const startSync = performance.now();
    try {
        const syncRes = await fetch(`${API_BASE}/stats/sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ days: 90 })
        });
        const syncData = await syncRes.json();
        const endSync = performance.now();
        console.log(`Sync took: ${(endSync - startSync).toFixed(2)}ms`);
    } catch (e) {
        console.error('Sync failed', e);
    }

    console.log('\n--- TEST 2: GET MESSAGES 90d ---');
    const startGetMsg = performance.now();
    try {
        const getMsgRes = await fetch(`${API_BASE}/stats?type=messages&period=90d`);
        await getMsgRes.json();
        console.log(`Get Messages (90d) took: ${(performance.now() - startGetMsg).toFixed(2)}ms`);
    } catch (e) {
        console.error('Get Messages failed', e);
    }
    
    console.log('\n--- TEST 3: GET VOICE 90d ---');
    const startGetVoice = performance.now();
    try {
        const getVoiceRes = await fetch(`${API_BASE}/stats?type=voice&period=90d`);
        await getVoiceRes.json();
        console.log(`Get Voice (90d) took: ${(performance.now() - startGetVoice).toFixed(2)}ms`);
    } catch (e) {
        console.error('Get Voice failed', e);
    }
}

testStats('1374115841855197184');
