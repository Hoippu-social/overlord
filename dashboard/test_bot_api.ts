import http from 'http';

async function testEnrich() {
    const guildId = '1374115841855197184';
    const userIds = ['218751322613088256'];
    const payload = JSON.stringify({ guildId, userIds, channelIds: [] });

    console.log('Testing bot enrich API on port 3002...');

    const req = http.request({
        hostname: '127.0.0.1',
        port: 3002,
        path: '/api/enrich',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': payload.length
        }
    }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
            console.log('Status:', res.statusCode);
            console.log('Body:', body);
        });
    });

    req.on('error', e => console.error('Error:', e.message));
    req.write(payload);
    req.end();
}

testEnrich();
