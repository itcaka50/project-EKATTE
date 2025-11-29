import fs from 'fs/promises';
import pool from '../db.js';
import Ajv from 'ajv';

const ajv = new Ajv();

const regionSchema = { type: 'object',
    properties : { code : {type : 'string'}, name : {type : 'string'} },
    required : ['code', 'name'] };
const validateRegion = ajv.compile(regionSchema);

const municipalitySchema = { type : 'object',
    properties : { code : {type : 'string'}, name : {type : 'string'}, region_code : {type : 'string'} },
    required : ['code', 'name', 'region_code'] };
const validateMunicipality = ajv.compile(municipalitySchema);

const townhallSchema = { type : 'object',
    properties : { code : {type : 'string'}, name : {type : 'string'}, municipality_code : {type : 'string'} },
    required : ['code', 'name', 'municipality_code'] };
const validateTownHall = ajv.compile(townhallSchema);

const territorialunitsSchema = { type : 'object',
    properties : { ekatte : {type : 'string'}, name : {type : 'string'}, type : {type : 'string'}, town_hall_code : {type : 'string'} },
    required : ['ekatte', 'name', 'town_hall_code'] };
const validateTerritorialUnit = ajv.compile(territorialunitsSchema);

async function fetchData(url) {
    const res = await fetch(url + "/json");
    if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);

    const data = await res.json();
    if (!Array.isArray(data)) throw new Error('Expected an array from the fetched data');

    return data;
}

async function insertDataBatch(client, table, columns, rows, conflictColumn) {
    if (!rows.length) return;
    const placeholders = rows
    .map((row, rowIndx) => {
        const params = columns
        .map((col, colIndx) => `$${rowIndx * columns.length + colIndx + 1}`)
        .join(',');
        return `(${params})`;
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

function removeDuplicates(rows, conflictColumn) {
    const seen = new Set();
    return rows.filter(row => {
        if (seen.has(row[conflictColumn])) return false;
        seen.add(row[conflictColumn]);
        return true;
    });
}

async function importFromFile(path) {
    const client = await pool.connect();

    try {
        const raw = await fs.readFile(path, 'utf8');
        const urls = JSON.parse(raw);

        await client.query('BEGIN');

        const regionsRaw = await fetchData(urls.regions);
        const slicedRegionsJson = regionsRaw.map((x) => ({
            code: x.oblast,
            name: x.name
        }));
        const regions = slicedRegionsJson.filter(validateRegion);
        
        await insertBatches(client, 'regions', ['code', 'name'] , regions, 'code');
   
        const municipalitiesRaw = await fetchData(urls.municipalities);
        const slicedMunicipalitiesJson = municipalitiesRaw.filter(x => x.obshtina && x.name)
            .map((x) => ({
            code: x.obshtina,
            name: x.name,
            region_code: x.obshtina.slice(0, 3)
        }));
        const municipalities = slicedMunicipalitiesJson.filter(validateMunicipality);
        
        await insertBatches(client, 'municipalities', ['code', 'name', 'region_code'] , municipalities, 'code');

        const townHallsRaw = await fetchData(urls.town_halls);
        const slicedTownHallsJson = townHallsRaw.filter(x => x.kmetstvo && x.name)
            .map((x) => ({
            code: x.kmetstvo,
            name: x.name,
            municipality_code: x.kmetstvo.slice(0, 5)
        }));
        let townHalls = slicedTownHallsJson.filter(validateTownHall);
        
        const territorialUnitsRaw = await fetchData(urls.territorial_units);
        let slicedTerritorialUnitsJson = territorialUnitsRaw.filter(x => x.ekatte && x.name && x.kmetstvo)
            .map((x) => ({
            ekatte: x.ekatte,
            name: x.name,
            type: x.kind?.toString() || null,
            town_hall_code: x.kmetstvo
        }));
        let territorialUnits = slicedTerritorialUnitsJson.filter(validateTerritorialUnit);
        

        const townHallCodesSet = new Set(townHalls.map(th => th.code));
        const missingTownHalls = territorialUnits
        .filter(tu => !townHallsCodesSet.has(tu.town_hall_code))
        .map(tu => { 
            const municipalityCode = tu.town_hall_code.slice(0, 5);
            const municipality = municipalities.find(m => m.code === municipalityCode);

            return {
                code: tu.town_hall_code,
                name: municipality?.name || tu.name,
                municipality_code: municipalityCode
            };
        }); 

        if (missingTownHalls.length > 0) {
            townHalls = [...townHalls, ...missingTownHalls];
        }

        townHalls = removeDuplicates(townHalls, 'code');
        territorialUnits = removeDuplicates(territorialUnits, 'ekatte');

        await insertBatches(client, 'town_halls', ['code', 'name', 'municipality_code'] , townHalls, 'code');
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
}

const filePath = './urls.json';
importFromFile(filePath);

export { 
    fetchData, 
    insertDataBatch, 
    insertBatches, 
    removeDuplicates, 
    importFromFile,
    validateRegion,
    validateMunicipality,
    validateTownHall,
    validateTerritorialUnit
};