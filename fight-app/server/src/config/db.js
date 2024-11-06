const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: 'fight-app-db',
  database: 'fightpick_db',
  password: 'postgres',
  port: 5432,
});

// Add error handling
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

module.exports = pool; 