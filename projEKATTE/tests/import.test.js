import fs from 'fs/promises';
import pool from '../db.js';
import { insertDataBatch, insertBatches, importFromFile } from '../importData/import.js';

jest.mock('../db.js');
jest.mock('fs/promises');
jest.mock('../importData/import.js', () => ({
  ...jest.requireActual('../importData/import.js'),
  fetchData: jest.fn(),
  validateRegion: jest.fn(),
  validateMunicipality: jest.fn(),
  validateTownHall: jest.fn(),
  validateTerritorialUnit: jest.fn(),
}));

const { fetchData, validateRegion, validateMunicipality, validateTownHall, validateTerritorialUnit } = require('../import.js');

describe('Import functions', () => {
  let client;

  beforeEach(() => {
    client = { query: jest.fn(), release: jest.fn() };
    pool.connect = jest.fn().mockResolvedValue(client);
    jest.clearAllMocks();
  });

  test('insertDataBatch should do nothing with empty rows', async () => {
    await insertDataBatch(client, 'regions', ['code', 'name'], [], 'code');
    expect(client.query).not.toHaveBeenCalled();
  });

  test('insertDataBatch should generate correct SQL for single row', async () => {
    const rows = [{ code: '01', name: 'София' }];
    await insertDataBatch(client, 'regions', ['code', 'name'], rows, 'code');
    expect(client.query).toHaveBeenCalled();
    const sql = client.query.mock.calls[0][0];
    expect(sql).toContain('INSERT INTO regions (code,name)');
    expect(sql).toContain('ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name');
    expect(client.query.mock.calls[0][1]).toEqual(['01', 'София']);
  });

  test('insertDataBatch should handle multiple rows', async () => {
    const rows = [
      { code: '01', name: 'София' },
      { code: '02', name: 'Пловдив' },
    ];
    await insertDataBatch(client, 'regions', ['code', 'name'], rows, 'code');
    const values = client.query.mock.calls[0][1];
    expect(values).toEqual(['01', 'София', '02', 'Пловдив']);
  });

  test('insertDataBatch should throw if query fails', async () => {
    client.query.mockRejectedValueOnce(new Error('SQL error'));
    await expect(insertDataBatch(client, 'regions', ['code', 'name'], [{ code: '01', name: 'София' }], 'code'))
      .rejects.toThrow('SQL error');
  });

  test('insertBatches should split rows into batches', async () => {
    const rows = Array.from({ length: 3 }, (_, i) => ({ code: `${i}`, name: `Name${i}` }));
    await insertBatches(client, 'regions', ['code','name'], rows, 'code', 2); // batch size 2
    expect(client.query).toHaveBeenCalledTimes(2); // 2 batches
  });

  test('importFromFile should fetch and insert data correctly', async () => {
    const urls = {
      regions: 'regions-url',
      municipalities: 'municipalities-url',
      town_halls: 'townhalls-url',
      territorial_units: 'territorial-url'
    };
    fs.readFile.mockResolvedValue(JSON.stringify(urls));
    
    fetchData.mockResolvedValue([{ code: '01', name: 'София', region_code: '01', municipality_code: '01', town_hall_code: '01', type: 'city' }]);
    validateRegion.mockReturnValue(true);
    validateMunicipality.mockReturnValue(true);
    validateTownHall.mockReturnValue(true);
    validateTerritorialUnit.mockReturnValue(true);

    await importFromFile('dummy-path');

    expect(client.query).toHaveBeenCalledWith('BEGIN');
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO regions'), expect.any(Array));
    expect(client.query).toHaveBeenCalledWith('COMMIT');
    expect(client.release).toHaveBeenCalled();
  });

  test('importFromFile should rollback on error', async () => {
    fs.readFile.mockResolvedValue(JSON.stringify({ regions: 'url' }));
    fetchData.mockRejectedValueOnce(new Error('Fetch failed'));

    await importFromFile('dummy-path');
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.release).toHaveBeenCalled();
  });

  test('importFromFile should handle empty fetchData', async () => {
    fs.readFile.mockResolvedValue(JSON.stringify({ regions: 'url' }));
    fetchData.mockResolvedValue([]);

    await importFromFile('dummy-path');
    expect(client.query).toHaveBeenCalledWith('BEGIN');
    expect(client.query).toHaveBeenCalledWith('COMMIT');
  });
});
