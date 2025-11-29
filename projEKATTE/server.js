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
        const like = `%${q}%`;
        const results = {};

        const tu = await client.query(
            `SELECT COUNT(*) AS cnt
             FROM territorial_units
             WHERE name ILIKE $1`,
            [like]
        );
        results.territorial_units = Number(tu.rows[0].cnt);

        const th = await client.query(
            `SELECT COUNT(DISTINCT th.code) AS cnt
             FROM town_halls th
             JOIN territorial_units tu ON tu.town_hall_code = th.code
             WHERE tu.name ILIKE $1`,
            [like]
        );
        results.unique_town_halls = Number(th.rows[0].cnt);

        const m = await client.query(
            `SELECT COUNT(DISTINCT m.code) AS cnt
             FROM municipalities m
             JOIN town_halls th ON th.municipality_code = m.code
             JOIN territorial_units tu ON tu.town_hall_code = th.code
             WHERE tu.name ILIKE $1`,
            [like]
        );
        results.unique_municipalities = Number(m.rows[0].cnt);

        const r = await client.query(
            `SELECT COUNT(DISTINCT r.code) AS cnt
             FROM regions r
             JOIN municipalities m ON m.region_code = r.code
             JOIN town_halls th ON th.municipality_code = m.code
             JOIN territorial_units tu ON tu.town_hall_code = th.code
             WHERE tu.name ILIKE $1`,
            [like]
        );
        results.unique_regions = Number(r.rows[0].cnt);

        return results;
    }
    catch(err) {
        console.error("Couldn't query the count ", err);
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
        if (!res.rows || res.rows.length === 0) {
            return 0;
        }
        return Number(res.rows[0].count);
    }
    catch (err) {
        console.error('Search count failed', err); 
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

        else if (u.pathname === '/' || u.pathname === '/index.html') {
            const html = await fs.readFile(new URL('./frontend/index.html', import.meta.url), 'utf8');
            res.writeHead(200, {'Content-Type' : 'text/html' });
            res.end(html);
            return;
        }

        else if (u.pathname === '/style.css') {
            const css = await fs.readFile(new URL('./frontend/style.css', import.meta.url), 'utf8');
            res.writeHead(200, {'Content-Type' : 'text/css' });
            res.end(css);
            return;
        }

        else if (u.pathname === '/script.js') {
            const jeies = await fs.readFile(new URL('./frontend/script.js', import.meta.url), 'utf8');
            res.writeHead(200, {'Content-Type' : 'text/javascript'});
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


if (process.env.NODE_ENV !== 'test') {
    server.listen(3000, () => console.log('Server running on 3000'));
}

export { search, counts, searchCount, server };
