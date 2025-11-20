import http from 'http';
import url from 'url';
import fs from 'fs/promises';
import pool from './db.js';

const PORT = process.env.PORT || 3000;

async function search(q, limit = 25, offset = 0) {
    const client = await pool.connect();

    try {
        const res = await client.query(
           `SELECT t.ekatte, t.name, th.name AS town_hall, m.name AS municipality, r.name AS region
            FROM territorial_units t
            LEFT JOIN town_halls th ON t.town_hall_code = th.code
            LEFT JOIN municipalities m ON th.municipality_code = m.code
            LEFT JOIN regions r ON m.region_code = r.code
            WHERE t.name ILIKE $1
            ORDER BY t.name
            LIMIT $2 OFFSET $3`,
            [`%${q}%`, limit, offset]
        );
        return res.rows;
    }
    catch (error) {
        console.error("Couldn't finish the query ", error);
    }
    finally {
        client.release();
    }
}

async function counts(q) {
    const client = await pool.connect();
    
    try {
        const results = {};

        for (const table of ['territorial_units', 'town_halls', 'municipalities', 'regions']) {
            const r = await client.query(`SELECT count(*) FROM ${table} WHERE name ILIKE $1`, [`%${q}%`]);
            results[table] = Number(r.rows[0].count);
        }
        return results;
    }
    catch (error) {
        console.error("Couldn't query the count ", error);
    }
    finally {
        client.release();
    }
}

async function searchCount(q) {
    const client = await pool.connect();

    try {
        const res = await client.query(
            `SELECT COUNT(*) FROM territorial_units WHERE name ILIKE $1`,
            [`%${q}%`]
        );
        return Number(res.rows[0].count);
    }
    finally {
        client.release();
    }
}


const server = http.createServer (async (req, res) => {
    const u = url.parse(req.url, true);

    try {
        if (u.pathname === '/api/search') {
        const q = u.query.q || '';
        const limit = parseInt(u.query.limit) || 25;
        const offset = parseInt(u.query.offset) || 0;

        const results = await search(q, limit, offset);

        const stats = await counts(q);

        const total = await searchCount(q);

        res.writeHead(200, {'Content-Type' : 'application/json'});
        res.end(JSON.stringify({ results, stats, total }));
        return;
    }

        if (u.pathname === '/' || u.pathname === '/index.html') {
            const html = await fs.readFile(new URL('./frontend/index.html', import.meta.url), 'utf8');
            res.writeHead(200, {'Content-Type' : 'text/html' });
            res.end(html);
            return;
        }

        if (u.pathname === '/style.css') {
            const css = await fs.readFile(new URL('./frontend/style.css', import.meta.url), 'utf8');
            res.writeHead(200, {'Content-Type' : 'text/css' });
            res.end(css);
            return;
        }

        if (u.pathname === '/script.js') {
            const jeies = await fs.readFile(new URL('./frontend/script.js', import.meta.url), 'utf8');
            res.writeHead(200, {'Content-type' : 'text/javascript'});
            res.end(jeies);
            return;
        }

        else {
            res.writeHead(404);
            res.end('Not found');
        }
    }
    catch (error) {
        console.error(error);
        res.writeHead(500);
        res.end('Internal error');
    }
});

server.listen(PORT, () => console.log('Server running on port', PORT));

export {search, counts};