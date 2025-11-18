import fs from 'fs/promises';
import pool from '../db.js';
import Ajv from 'ajv';
import { PropertyMixer } from 'three';

const Ajv = new Ajv();

const regionSchema = { type: 'object',
    properties : { code : {type : 'string'}, name : {type : 'string'} },
    required : ['code', 'name'] };
const validateRegion = Ajv.compile(regionSchema);

const municipalitySchema = { type : 'object',
    properties : { code : {type : 'string'}, name : {type : 'string'}, region_code : {type : 'string'} },
    required : ['code', 'name', 'region_code'] };
const validateMunicipality = Ajv.compile(municipalitySchema);

const townhallSchema = { type : 'object',
    properties : { code : {type : 'string'}, name : {type : 'string'}, municipality_code : {type : 'string'} },
    required : ['code', 'name', 'municipality_code'] };
const validateTownHall = Ajv.compile(townhallSchema);

const territorialunitsSchema = { type : 'object',
    properties : { ekatte : {type : 'string'}, name : {type : 'string'}, type : {type : 'string'}, town_hall_code : {type : 'string'} },
    required : ['ekatte', 'name', 'town_hall_code'] };
const validateTerritorialUnit = Ajv.compile(territorialunitsSchema);

async function fetchData(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch ${url}: ${res.status}');

    const data = await res.json();
    if (!Array.isArray(data)) throw new Error('Expected an array from the fetched data');

    return data;
}

async function insertDataBatch(client, table, columns, rows, conflictColumn) {
    if (!rows.length) return;
    const placeholders = rows
    .map((row, rowIndx) => {
        const params = columns
        .map((col, colIndx) => '$${rowIndx * columns.length + colIndx + 1}')
        .join(',');
        return '(${params})';
    })
    .join(',');

    const sql = `
    INSERT INTO ${table} (${columns.join(',')})
    VALUES ${placeholders}
    ON CONFLICT (${conflictColumn}) DO UPDATE SET
      ${columns
        .filter((c) => c !== conflictColumn)
        .map((c) => `${c}=EXCLUDED.${c}`)
        .join(',')}; `;

    const values = rows.flatMap((r) => columns.map((c) => r[c] ?? null));
    await client.query(sql, values);
}

async function insertBatches(client, table, columns, rows, conflictColumn, batchSize = 500) {
    for (let i = 0; i < rows.length; i += batchSize) {
        const chunk = rows.slice(i, i + batchSize);
        await insertDataBatch(client, table, columns, chunk, conflictColumn);
    }
}

async function importFromFile(path) {
    const client = await pool.connect();

    try {
        const raw = await fs.readFile(path, 'utf8');
        const urls = JSON.parse(raw);

        await client.query('BEGIN');

        const regionsRaw = await fetchData(urls.regions);
        const regions = regionsRaw.filter(validateRegion);
        await insertBatches(client, 'regions', ['code', 'name'] , regions, 'code');
   
        const municipalitiesRaw = await fetchData(urls.municipalities);
        const municipalities = municipalitiesRaw.filter(validateMunicipality);
        await insertBatches(client, 'municipalities', ['code', 'name', 'region_code'] , municipalities, 'code');

        const townHallsRaw = await fetchData(urls.town_halls);
        const townHalls = townHallsRaw.filter(validateTownHall);
        await insertBatches(client, 'town_halls', ['code', 'name', 'municipality_code'] , townHalls, 'code');

        const territorialUnitsRaw = await fetchData(urls.territorial_units);
        const territorialUnits = territorialUnitsRaw.filter(validateTerritorialUnit);
        await insertBatches(client, 'territorial_units', ['ekatte', 'name', 'type', 'town_hall_code'] , territorialUnits, 'ekatte');

        await client.query('COMMIT');
        console.log('Import completed successfully (batched)');
    }
    catch (err) {
        await client.query('ROLLBACK');
        console.error('Import failed', err);
    }
    finally {
        client.release();
    }

    const filePath = './urls.json';
    importFromFile(filePath);
}