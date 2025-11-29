import { jest } from '@jest/globals';
import http from 'http';

process.env.NODE_ENV = 'test';

const mockClient = {
    query: jest.fn(),
    release: jest.fn()
};

const mockPool = {
    connect: jest.fn(() => Promise.resolve(mockClient))
};

jest.unstable_mockModule('../db.js', () => ({
    default: mockPool
}));

jest.unstable_mockModule('fs/promises', () => ({
    default: {
        readFile: jest.fn()
    }
}));

const { search, counts, searchCount, server } = await import('../server.js');
const fs = (await import('fs/promises')).default;

describe('EKATTE server logic', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockClient.query.mockClear();
        mockClient.release.mockClear();
        mockPool.connect.mockClear();

        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
    });

    describe('search()', () => {
        test('should query territorial units correctly', async () => {
            const fakeRows = [
                { ekatte: '12345', name: 'София', town_hall: null, municipality: 'СО', region: 'София-град' }
            ];
            mockClient.query.mockResolvedValue({ rows: fakeRows });

            const result = await search('Соф');
            
            expect(mockClient.query).toHaveBeenCalledWith(
                expect.stringContaining('WHERE t.name ILIKE $1'),
                ['%Соф%', 25, 0]
            );
            expect(result).toEqual(fakeRows);
            expect(mockClient.release).toHaveBeenCalled();
        });

        test('should go into catch block', async () => {
                mockClient.query.mockRejectedValue(new Error('Test error'));

                const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

                const result = await search('Соф'); 

                expect(consoleErrorSpy).toHaveBeenCalledWith(
                    "Couldn't finish the query ",
                    expect.any(Error)
                );
                expect(mockClient.release).toHaveBeenCalled();
                expect(result).toBeUndefined();
                consoleErrorSpy.mockRestore();
        })
    });

    describe('Counts and searchCount error handling', () => {
    let consoleErrorSpy;

    beforeEach(() => {
        jest.clearAllMocks();
        mockClient.query.mockClear();
        mockClient.release.mockClear();
        mockPool.connect.mockClear();

        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
    });

    test('counts() should enter catch block on query error', async () => {
            mockClient.query.mockRejectedValue(new Error('Test count error'));

            const result = await counts('Соф');

            expect(consoleErrorSpy).toHaveBeenCalledWith(
                "Couldn't query the count ",
                expect.any(Error)
            );
            expect(mockClient.release).toHaveBeenCalled();
            expect(result).toBeUndefined();
        });

        test('searchCount() should enter catch block on query error', async () => {

            mockClient.query.mockRejectedValue(new Error('Test searchCount error'));

            const result = await searchCount('Соф');

            expect(consoleErrorSpy).toHaveBeenCalledWith(
                'Search count failed',
                expect.any(Error)
            );
            expect(mockClient.release).toHaveBeenCalled();
            expect(result).toBeUndefined();
        });
    });


    describe('HTTP Server', () => {

        function createMockRes(done, expectedData, expectedCode = 200, expectedType = 'text/plain') {
            return {
                writeHead: jest.fn((code, headers) => {
                    expect(code).toBe(expectedCode);
                    if (headers['Content-Type']) {
                        expect(headers['Content-Type']).toBe(expectedType);
                    }
                }),
                end: jest.fn((data) => {
                    expect(data).toBe(expectedData);
                    done();
                })
            };
        }

        test('should handle /api/search endpoint', (done) => {
            mockClient.query
                .mockResolvedValueOnce({ rows: [{ ekatte: '1', name: 'София' }] })
                .mockResolvedValueOnce({ rows: [{ count: '1' }] })
                .mockResolvedValueOnce({ rows: [{ count: '0' }] })
                .mockResolvedValueOnce({ rows: [{ count: '0' }] })
                .mockResolvedValueOnce({ rows: [{ count: '0' }] })
                .mockResolvedValueOnce({ rows: [{ count: '1' }] });

            const req = { url: '/api/search?q=София&limit=25&offset=0' };
            const res = {
                writeHead: jest.fn(),
                end: jest.fn((data) => {
                    const parsed = JSON.parse(data);
                    expect(parsed).toHaveProperty('results');
                    expect(parsed).toHaveProperty('stats');
                    expect(parsed).toHaveProperty('total');
                    expect(res.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'application/json' });
                    done();
                })
            };

            server.emit('request', req, res);
        });

        test('should serve index.html on root path', (done) => {
            fs.readFile.mockResolvedValue('<html>test</html>');

            const req = { url: '/' };
            const res = createMockRes(done, '<html>test</html>', 200, 'text/html');
            server.emit('request', req, res);
        });

        test('should serve style.css', (done) => {
            fs.readFile.mockResolvedValue('body { color: red; }');

            const req = { url: '/style.css' };
            const res = createMockRes(done, 'body { color: red; }', 200, 'text/css');
            server.emit('request', req, res);
        });

        test('should serve script.js', (done) => {
            fs.readFile.mockResolvedValue('console.log("test");');

            const req = { url: '/script.js' };
            const res = createMockRes(done, 'console.log("test");', 200, 'text/javascript');
            server.emit('request', req, res);
        });

        test('should return 404 for unknown paths', (done) => {
            const req = { url: '/unknown' };
            const res = {
                writeHead: jest.fn(),
                end: jest.fn((data) => {
                    expect(res.writeHead).toHaveBeenCalledWith(404);
                    expect(data).toBe('Not found');
                    done();
                })
            };
            server.emit('request', req, res);
        });

        test('should handle errors with 500 response', (done) => {
            fs.readFile.mockRejectedValue(new Error('File read error'));

            const req = { url: '/' };
            const res = {
                writeHead: jest.fn(),
                end: jest.fn((data) => {
                    expect(res.writeHead).toHaveBeenCalledWith(500);
                    expect(data).toBe('Internal error');
                    done();
                })
            };
            server.emit('request', req, res);
        });
    });

        //
    // EXTRA TESTS (добави след края на файла)
    //

    describe('Additional search() tests', () => {
        test('search() should pass correct limit & offset', async () => {
            mockClient.query.mockResolvedValue({ rows: [] });

            await search('Тест', 50, 100);

            expect(mockClient.query).toHaveBeenCalledWith(
                expect.stringContaining('LIMIT $2 OFFSET $3'),
                ['%Тест%', 50, 100]
            );
        });

        test('search() should return empty array if query returns empty rows', async () => {
            mockClient.query.mockResolvedValue({ rows: [] });

            const result = await search('Няма');

            expect(result).toEqual([]);
        });
    });

    describe('Additional counts() tests', () => {
        test('counts() returns correct structured data', async () => {
            mockClient.query
                .mockResolvedValueOnce({ rows: [{ cnt: '10' }] })
                .mockResolvedValueOnce({ rows: [{ cnt: '2' }] })
                .mockResolvedValueOnce({ rows: [{ cnt: '1' }] })
                .mockResolvedValueOnce({ rows: [{ cnt: '1' }] });

            const result = await counts('Соф');

            expect(result).toEqual({
                territorial_units: 10,
                unique_town_halls: 2,
                unique_municipalities: 1,
                unique_regions: 1
            });
        });
    });

    describe('Additional searchCount() tests', () => {
        test('searchCount() returns a number on success', async () => {
            mockClient.query.mockResolvedValue({ rows: [{ count: '15' }] });

            const result = await searchCount('Соф');

            expect(result).toBe(15);
        });

        test('searchCount() returns 0 if empty result', async () => {
            mockClient.query.mockResolvedValue({ rows: [] });

            const result = await searchCount('Соф');

            expect(result).toBe(0);
        });

        test('should return 404 for /favicon.ico', (done) => {
            const req = { url: '/favicon.ico' };
            const res = {
                writeHead: jest.fn(),
                end: jest.fn(() => {
                    expect(res.writeHead).toHaveBeenCalledWith(404);
                    done();
                })
            };
            server.emit('request', req, res);
        });
    });
    });

