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

        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        console.error.mockRestore();
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
});
