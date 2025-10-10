// src/config/db.js
'use strict';
const mysql = require('mysql2/promise');

const {
  MYSQL_HOST = 'localhost',
  MYSQL_PORT = 3306,
  MYSQL_USER = 'root',
  MYSQL_PASSWORD = '',
  MYSQL_DATABASE = 'projetoPI',
} = process.env;

let pool;

/**
 * Cria o database se não existir (utf8mb4).
 */
async function ensureDatabase() {
  const serverPool = await mysql.createPool({
    host: MYSQL_HOST,
    port: Number(MYSQL_PORT),
    user: MYSQL_USER,
    password: MYSQL_PASSWORD,
    connectionLimit: 5
  });
  await serverPool.query(
    `CREATE DATABASE IF NOT EXISTS \`${MYSQL_DATABASE}\`
     DEFAULT CHARACTER SET utf8mb4
     DEFAULT COLLATE utf8mb4_unicode_ci;`
  );
  await serverPool.end();
}

/**
 * Garante a tabela mínima 'usuarios' (id, nome, email, created_at).
 * -> Atende à exigência de “ao menos uma tabela (ex: usuários)”.
 */
async function ensureTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INT PRIMARY KEY AUTO_INCREMENT,
      nome VARCHAR(100) NOT NULL,
      email VARCHAR(120) NOT NULL UNIQUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB
      DEFAULT CHARSET=utf8mb4
      COLLATE=utf8mb4_unicode_ci;
  `);
}

/**
 * Inicializa pool conectado ao DB e garante tabelas.
 */
async function initDb() {
  await ensureDatabase();
  pool = await mysql.createPool({
    host: MYSQL_HOST,
    port: Number(MYSQL_PORT),
    user: MYSQL_USER,
    password: MYSQL_PASSWORD,
    database: MYSQL_DATABASE,
    connectionLimit: 10,
    multipleStatements: false,
    charset: 'utf8mb4_unicode_ci',
  });
  await ensureTables();
  return pool;
}

/**
 * Retorna o pool de conexão.
 */
function getDb() {
  if (!pool) {
    throw new Error('Pool MySQL não inicializado. Chame initDb() no bootstrap.');
  }
  return pool;
}

module.exports = { initDb, getDb };