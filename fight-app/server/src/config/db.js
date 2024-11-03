const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',        // default PostgreSQL user
  host: 'localhost',       // database host
  database: 'fightpick_db', // database name we created
  password: 'your_password', // your PostgreSQL password
  port: 5432,             // default PostgreSQL port
});

module.exports = pool; 