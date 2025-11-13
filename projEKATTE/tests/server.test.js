import {search, counts} from '../server.js';
import pool from '../db.js';

jest.mock('../db.js');

describe('EKATTE server logic', () => {
    let client;

    beforeEach(() => {
        client = {
            query: jest.fn(),
            release: jest.fn()
        };
        pool.connect = jest.fn().mockResolvedValue(client);
    });

    afterEach(() => jest.clearAllMocks());

    test('search() should query settlements correctly', async () => {
      
        const fakeRows = [
        { ekatte: '12345', name: 'София', town_hall: null, municipality: 'СО', oblast: 'София-град' }
        ];
        client.query.mockResolvedValue({ rows: fakeRows });

        const result = await search('Соф');
        expect(client.query).toHaveBeenCalledWith(expect.stringContaining('WHERE s.name ILIKE $1'), ['%Соф%']);
        expect(result).toEqual(fakeRows);
        expect(client.release).toHaveBeenCalled();
    });

    test('search() should return empty array when no matches found', async () => {
      
        client.query.mockResolvedValue({ rows: [] });

        const result = await search('');
        expect(client.query).toHaveBeenCalledWith(expect.any(String), ['%%']);
        expect(result).toEqual([]);
    });

    test('search() should work case-insensitively with ILIKE', async () => {
       
        const fakeRows = [
            { ekatte: '12345', name: 'СОФИЯ', town_hall: null, municipality: 'СО', oblast: 'София-град' }
        ];
        client.query.mockResolvedValue({ rows: fakeRows });

        const result = await search('софия');
        expect(client.query).toHaveBeenCalledWith(expect.stringMatching(/ILIKE/), ['%софия%']);
        expect(result[0].name).toBe('СОФИЯ');
    });

    test('search() should throw and release client on SQL error', async () => {
        client.query.mockRejectedValue(new Error('syntax error'));

        await expect(search('something')).rejects.toThrow('syntax error');
        expect(client.release).toHaveBeenCalled();
        });

    test('counts() should query all tables and return counts', async () => {

        client.query.mockResolvedValueOnce({ rows: [{ count: '10' }] });
        client.query.mockResolvedValueOnce({ rows: [{ count: '5' }] });
        client.query.mockResolvedValueOnce({ rows: [{ count: '3' }] });
        client.query.mockResolvedValueOnce({ rows: [{ count: '1' }] });

        const result = await counts('Соф'); 
        expect(result).toEqual({
        settlements: 10,
        town_halls: 5,
        municipalities: 3,
        oblasts: 1
        });
        expect(client.release).toHaveBeenCalled();
    });

    test('counts() should return zeros when nothing matches', async () => {

        client.query
            .mockResolvedValueOnce({ rows: [{ count: '0' }] })
            .mockResolvedValueOnce({ rows: [{ count: '0' }] })
            .mockResolvedValueOnce({ rows: [{ count: '0' }] })
            .mockResolvedValueOnce({ rows: [{ count: '0' }] });

        const result = await counts('Несъществуващо');
        expect(result).toEqual({
            settlements: 0,
            town_halls: 0,
            municipalities: 0,
            oblasts: 0
        });
    });

    test('counts() should return mixed counts for partial matches', async () => {
        client.query
            .mockResolvedValueOnce({ rows: [{ count: '2' }] }) 
            .mockResolvedValueOnce({ rows: [{ count: '0' }] }) 
            .mockResolvedValueOnce({ rows: [{ count: '1' }] }) 
            .mockResolvedValueOnce({ rows: [{ count: '1' }] }); 
        const result = await counts('Соф');
        expect(result.settlements).toBe(2);
        expect(result.town_halls).toBe(0);
        expect(result.municipalities).toBe(1);
        expect(result.oblasts).toBe(1);
    });

    test('counts() should stop and release client if query fails', async () => {
       
        client.query
            .mockResolvedValueOnce({ rows: [{ count: '5' }] })
            .mockRejectedValueOnce(new Error('Table missing'));

        await expect(counts('Соф')).rejects.toThrow('Table missing');
        expect(client.release).toHaveBeenCalled();
    });

    test('search() should release client even on error', async () => {
        client.query.mockRejectedValue(new Error('DB error'));
        await expect(search('Соф')).rejects.toThrow('DB error');
        expect(client.release).toHaveBeenCalled();
    });
});
