import pg from 'pg';

const {Pool} = pg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:1112@localhost:5432/ekatte_db'
})

export default pool;