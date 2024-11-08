import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  user: 'postgres',
  password: 'postgres',
  host: 'db',
  port: 5432,
  database: 'fightpick_db'
});

export default pool; 