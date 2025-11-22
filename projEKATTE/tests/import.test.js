import { jest } from '@jest/globals';

const mockClient = {
    query: jest.fn(),
    release: jest.fn()
};

const mockPool = {
    connect: jest.fn(() => Promise.resolve(mockClient))
};

global.fetch = jest.fn();

jest.unstable_mockModule('../db.js', () => ({
    default: mockPool
}));

jest.unstable_mockModule('fs/promises', () => ({
    default: {
        readFile: jest.fn()
    }
}));

const { 
    fetchData, 
    insertDataBatch, 
    insertBatches, 
    removeDuplicates,
    importFromFile,
    validateRegion,
    validateMunicipality,
    validateTownHall,
    validateTerritorialUnit
} = await import('../importData/import.js');
const fs = (await import('fs/promises')).default;

describe('Import functions', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockClient.query.mockClear();
        mockClient.release.mockClear();
        mockPool.connect.mockClear();
        global.fetch.mockClear();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('fetchData()', () => {
        test('should fetch and return array data', async () => {
            const mockData = [{ id: 1, name: 'Test' }];
            global.fetch.mockResolvedValue({
                ok: true,
                json: async () => mockData
            });

            const result = await fetchData('https://test.com');

            expect(global.fetch).toHaveBeenCalledWith('https://test.com/json');
            expect(result).toEqual(mockData);
        });

        test('should throw error on non-ok response', async () => {
            global.fetch.mockResolvedValue({
                ok: false,
                status: 404
            });

            await expect(fetchData('https://test.com')).rejects.toThrow('Failed to fetch');
        });

        test('should throw error if response is not array', async () => {
            global.fetch.mockResolvedValue({
                ok: true,
                json: async () => ({ data: 'not an array' })
            });

            await expect(fetchData('https://test.com')).rejects.toThrow('Expected an array');
        });

        test('should handle network errors', async () => {
            global.fetch.mockRejectedValue(new Error('Network error'));

            await expect(fetchData('https://test.com')).rejects.toThrow('Network error');
        });
    });

    describe('insertDataBatch()', () => {
        test('should do nothing with empty rows', async () => {
            await insertDataBatch(mockClient, 'regions', ['code', 'name'], [], 'code');
            expect(mockClient.query).not.toHaveBeenCalled();
        });

        test('should generate correct SQL for single row', async () => {
            const rows = [{ code: '01', name: 'София' }];
            mockClient.query.mockResolvedValue({});

            await insertDataBatch(mockClient, 'regions', ['code', 'name'], rows, 'code');

            expect(mockClient.query).toHaveBeenCalled();
            const sql = mockClient.query.mock.calls[0][0];
            expect(sql).toContain('INSERT INTO regions (code,name)');
            expect(sql).toContain('ON CONFLICT (code) DO UPDATE SET');
            expect(mockClient.query.mock.calls[0][1]).toEqual(['01', 'София']);
        });

        test('should handle multiple rows', async () => {
            const rows = [
                { code: '01', name: 'София' },
                { code: '02', name: 'Пловдив' },
            ];
            mockClient.query.mockResolvedValue({});

            await insertDataBatch(mockClient, 'regions', ['code', 'name'], rows, 'code');

            const values = mockClient.query.mock.calls[0][1];
            expect(values).toEqual(['01', 'София', '02', 'Пловдив']);
        });

        test('should handle null values', async () => {
            const rows = [{ code: '01', name: 'София', optional: null }];
            mockClient.query.mockResolvedValue({});

            await insertDataBatch(mockClient, 'regions', ['code', 'name', 'optional'], rows, 'code');

            const values = mockClient.query.mock.calls[0][1];
            expect(values).toEqual(['01', 'София', null]);
        });

        test('should throw if query fails', async () => {
            mockClient.query.mockRejectedValue(new Error('SQL error'));

            await expect(
                insertDataBatch(mockClient, 'regions', ['code', 'name'], [{ code: '01', name: 'София' }], 'code')
            ).rejects.toThrow('SQL error');
        });

        test('should handle undefined values as null', async () => {
            const rows = [{ code: '01', name: 'София', type: undefined }];
            mockClient.query.mockResolvedValue({});

            await insertDataBatch(mockClient, 'regions', ['code', 'name', 'type'], rows, 'code');

            const values = mockClient.query.mock.calls[0][1];
            expect(values).toEqual(['01', 'София', null]);
        });
    });

    describe('insertBatches()', () => {
        test('should split rows into batches', async () => {
            const rows = Array.from({ length: 3 }, (_, i) => ({
                code: `${i}`,
                name: `Name${i}`
            }));
            mockClient.query.mockResolvedValue({});

            await insertBatches(mockClient, 'regions', ['code', 'name'], rows, 'code', 2);

            expect(mockClient.query).toHaveBeenCalledTimes(2);
        });

        test('should handle exact batch size', async () => {
            const rows = Array.from({ length: 4 }, (_, i) => ({
                code: `${i}`,
                name: `Name${i}`
            }));
            mockClient.query.mockResolvedValue({});

            await insertBatches(mockClient, 'regions', ['code', 'name'], rows, 'code', 2);

            expect(mockClient.query).toHaveBeenCalledTimes(2);
        });

        test('should use default batch size of 500', async () => {
            const rows = Array.from({ length: 5 }, (_, i) => ({
                code: `${i}`,
                name: `Name${i}`
            }));
            mockClient.query.mockResolvedValue({});

            await insertBatches(mockClient, 'regions', ['code', 'name'], rows, 'code');

            expect(mockClient.query).toHaveBeenCalledTimes(1);
        });

        test('should handle large datasets', async () => {
            const rows = Array.from({ length: 1500 }, (_, i) => ({
                code: `${i}`,
                name: `Name${i}`
            }));
            mockClient.query.mockResolvedValue({});

            await insertBatches(mockClient, 'regions', ['code', 'name'], rows, 'code', 500);

            expect(mockClient.query).toHaveBeenCalledTimes(3);
        });
    });

    describe('removeDuplicates()', () => {
        test('should remove duplicate codes', () => {
            const rows = [
                { code: '01', name: 'София' },
                { code: '02', name: 'Пловдив' },
                { code: '01', name: 'София Дубликат' }
            ];

            const result = removeDuplicates(rows, 'code');

            expect(result).toHaveLength(2);
            expect(result[0]).toEqual({ code: '01', name: 'София' });
            expect(result[1]).toEqual({ code: '02', name: 'Пловдив' });
        });

        test('should return empty array for empty input', () => {
            const result = removeDuplicates([], 'code');
            expect(result).toEqual([]);
        });

        test('should keep all rows if no duplicates', () => {
            const rows = [
                { code: '01', name: 'София' },
                { code: '02', name: 'Пловдив' },
                { code: '03', name: 'Варна' }
            ];

            const result = removeDuplicates(rows, 'code');

            expect(result).toHaveLength(3);
            expect(result).toEqual(rows);
        });

        test('should work with different conflict columns', () => {
            const rows = [
                { ekatte: '12345', name: 'София' },
                { ekatte: '67890', name: 'Пловдив' },
                { ekatte: '12345', name: 'София Дубликат' }
            ];

            const result = removeDuplicates(rows, 'ekatte');

            expect(result).toHaveLength(2);
            expect(result.map(r => r.ekatte)).toEqual(['12345', '67890']);
        });

        test('should keep first occurrence of duplicates', () => {
            const rows = [
                { code: '01', name: 'First', value: 1 },
                { code: '01', name: 'Second', value: 2 },
                { code: '01', name: 'Third', value: 3 }
            ];

            const result = removeDuplicates(rows, 'code');

            expect(result).toHaveLength(1);
            expect(result[0].name).toBe('First');
            expect(result[0].value).toBe(1);
        });
    });

    describe('importFromFile()', () => {
        test('should successfully import all data', async () => {
            const urls = {
                regions: 'https://test.com/regions',
                municipalities: 'https://test.com/municipalities',
                town_halls: 'https://test.com/town_halls',
                territorial_units: 'https://test.com/territorial_units'
            };

            fs.readFile.mockResolvedValue(JSON.stringify(urls));

            global.fetch
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => [{ oblast: '01', name: 'София' }]
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => [{ obshtina: '01001', name: 'София', region_code: '010' }]
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => [{ kmetstvo: '01001-00', name: 'Кметство София' }]
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => [{ 
                        ekatte: '12345', 
                        name: 'Село', 
                        kmetstvo: '01001-00',
                        kind: 'с'
                    }]
                });

            mockClient.query.mockResolvedValue({});

            await importFromFile('test.json');

            expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
            expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
            expect(mockClient.release).toHaveBeenCalled();
        });

        test('should rollback on error', async () => {
            fs.readFile.mockResolvedValue(JSON.stringify({ regions: 'url' }));
            global.fetch.mockRejectedValue(new Error('Network error'));

            await importFromFile('test.json');

            expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
            expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
            expect(mockClient.release).toHaveBeenCalled();
        });

        test('should handle missing town_halls generation', async () => {
            const urls = {
                regions: 'https://test.com/regions',
                municipalities: 'https://test.com/municipalities',
                town_halls: 'https://test.com/town_halls',
                territorial_units: 'https://test.com/territorial_units'
            };

            fs.readFile.mockResolvedValue(JSON.stringify(urls));

            global.fetch
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => [{ oblast: '01', name: 'София' }]
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => [{ obshtina: '01001', name: 'София' }]
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => []
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => [{ 
                        ekatte: '12345', 
                        name: 'Село', 
                        kmetstvo: '01001-00'
                    }]
                });

            mockClient.query.mockResolvedValue({});

            await importFromFile('test.json');

            expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
        });

        test('should filter invalid data', async () => {
            const urls = {
                regions: 'https://test.com/regions',
                municipalities: 'https://test.com/municipalities',
                town_halls: 'https://test.com/town_halls',
                territorial_units: 'https://test.com/territorial_units'
            };

            fs.readFile.mockResolvedValue(JSON.stringify(urls));

            global.fetch
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => [
                        { oblast: '01', name: 'София' },
                        { oblast: '02' }
                    ]
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => []
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => []
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => []
                });

            mockClient.query.mockResolvedValue({});

            await importFromFile('test.json');

            expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
        });
    });

    describe('Validation functions', () => {
        test('validateRegion should validate correct region', () => {
            expect(validateRegion({ code: '01', name: 'София' })).toBe(true);
        });

        test('validateRegion should reject missing code', () => {
            expect(validateRegion({ name: 'София' })).toBe(false);
        });

        test('validateRegion should reject missing name', () => {
            expect(validateRegion({ code: '01' })).toBe(false);
        });

        test('validateMunicipality should validate correct municipality', () => {
            expect(validateMunicipality({ 
                code: '01001', 
                name: 'София', 
                region_code: '01' 
            })).toBe(true);
        });

        test('validateMunicipality should reject missing region_code', () => {
            expect(validateMunicipality({ 
                code: '01001', 
                name: 'София' 
            })).toBe(false);
        });

        test('validateTownHall should validate correct town hall', () => {
            expect(validateTownHall({ 
                code: '01001-00', 
                name: 'Кметство', 
                municipality_code: '01001' 
            })).toBe(true);
        });

        test('validateTownHall should reject missing municipality_code', () => {
            expect(validateTownHall({ 
                code: '01001-00', 
                name: 'Кметство' 
            })).toBe(false);
        });

        test('validateTerritorialUnit should validate with type', () => {
            expect(validateTerritorialUnit({ 
                ekatte: '12345', 
                name: 'Село', 
                type: 'с',
                town_hall_code: '01001-00' 
            })).toBe(true);
        });

        test('validateTerritorialUnit should validate without type', () => {
            expect(validateTerritorialUnit({ 
                ekatte: '12345', 
                name: 'Село',
                town_hall_code: '01001-00' 
            })).toBe(true);
        });

        test('validateTerritorialUnit should reject missing town_hall_code', () => {
            expect(validateTerritorialUnit({ 
                ekatte: '12345', 
                name: 'Село' 
            })).toBe(false);
        });
    });
});