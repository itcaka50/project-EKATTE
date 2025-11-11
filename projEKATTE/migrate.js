import fs from 'fs';
import pool from './db.js';

const sql = fs.readFileSync(new URL('./migrations/schema.sql', import.meta.url), 'utf8');

(async () => {
    const client = await pool.connect();
    try {
        await client.query(sql);
        console.log('migration applied successfully');
    } catch (error) {
        console.error('migration failed', error);
    } finally {
        client.release();
        process.exit(0);
    }
})();