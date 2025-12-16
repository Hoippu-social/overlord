const { PrismaClient } = require('@prisma/client');

async function main() {
    const prisma = new PrismaClient();
    try {
        const guilds = await prisma.guild.findMany();
        console.log('Found', guilds.length, 'guilds:');
        guilds.forEach(g => console.log('  -', g.id, g.name));
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

main();
