const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./prisma/stats.db', (err) => {
    if (err) console.error(err);
});
db.all("SELECT name FROM sqlite_master WHERE type='table';", (err, rows) => {
    console.log("Tables in stats.db:", rows);
    if (rows) {
        rows.forEach(row => {
            db.get(`SELECT COUNT(*) as count FROM "${row.name}"`, (err, countRow) => {
                console.log(`Table ${row.name}: ${countRow?.count} rows`);
            });
        });
    }
});
