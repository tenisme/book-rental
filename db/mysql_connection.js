const mysql = require("mysql2");

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.DB_PASSWD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
});

const connection = pool.promise();

module.exports = connection;
