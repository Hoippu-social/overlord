throw new Error(
    [
        'The legacy stats migration script has been retired.',
        'Stats storage is PostgreSQL-only now.',
        'Use the dashboard scripts: stats:pg:prepare, stats:pg:backfill, and stats:pg:parity.',
    ].join(' ')
);
