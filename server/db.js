require("dotenv").config();
const { Pool, types } = require("pg");

types.setTypeParser(1082, (valor) => valor);

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

module.exports = pool;
