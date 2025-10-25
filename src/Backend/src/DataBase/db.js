// src/DataBase/db.js 
import 'dotenv/config';
import mysql from 'mysql2/promise';

const {
  MYSQL_HOST = '127.0.0.1',           // IPv4 evita surpresa com IPv6 (localhost -> ::1)
  MYSQL_PORT = 3306,
  MYSQL_USER = 'root',
  MYSQL_PASSWORD = '',
  MYSQL_DATABASE = 'projetoPI',       // <<-- não deixe vazio em prod
} = process.env;

export let pool;

/** Cria o database caso não exista */
async function ensureDatabase() {
  const serverPool = await mysql.createPool({
    host: MYSQL_HOST,
    port: Number(MYSQL_PORT),
    user: MYSQL_USER,
    password: MYSQL_PASSWORD,
    connectionLimit: 5,
  });

  if (!MYSQL_DATABASE) {
    console.warn('⚠️  MYSQL_DATABASE está vazio no .env. Defina para evitar ER_NO_DB_ERROR.');
  } else {
    await serverPool.query(
      `CREATE DATABASE IF NOT EXISTS \`${MYSQL_DATABASE}\`
       DEFAULT CHARACTER SET utf8mb4
       DEFAULT COLLATE utf8mb4_unicode_ci;`
    );
  }
  await serverPool.end();
}

/** Cria as tabelas essenciais (compatíveis com seus controllers) */
async function ensureTables() {
  // Tabela grupo (usa nome_grupo, compatível com metasController e outros joins)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS grupo (
      ID_grupo           INT AUTO_INCREMENT PRIMARY KEY,
      nome_grupo         VARCHAR(120) NOT NULL,
      meta_arrecadacao   DECIMAL(12,2) DEFAULT 0,
      meta_alimentos     VARCHAR(120),
      capa_url           VARCHAR(255),
      mentor             VARCHAR(120) NULL,
      mentor_id          INT NULL,
      criado_em          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      atualizado_em      DATETIME NULL ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB
      DEFAULT CHARSET=utf8mb4
      COLLATE=utf8mb4_unicode_ci;
  `);

  // Tabela de membros do grupo
  await pool.query(`
    CREATE TABLE IF NOT EXISTS grupo_membro (
      ID_membro INT AUTO_INCREMENT PRIMARY KEY,
      ID_grupo  INT NOT NULL,
      nome      VARCHAR(120) NOT NULL,
      ra        VARCHAR(32) NOT NULL,
      telefone  VARCHAR(32),
      CONSTRAINT fk_membro_grupo
        FOREIGN KEY (ID_grupo) REFERENCES grupo(ID_grupo)
        ON DELETE CASCADE ON UPDATE CASCADE
    ) ENGINE=InnoDB
      DEFAULT CHARSET=utf8mb4
      COLLATE=utf8mb4_unicode_ci;
  `);

  // Tabela usuario (compatível com seus controllers)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS usuario (
      ID_usuario   INT AUTO_INCREMENT PRIMARY KEY,
      RA           VARCHAR(32)  NULL,
      nome_usuario VARCHAR(120) NOT NULL,
      email        VARCHAR(160) NULL,
      senha        VARCHAR(255) NOT NULL,
      cargo        VARCHAR(32)  NOT NULL,        -- 'adm' | 'mentor' | 'aluno'
      ID_grupo     INT NULL,
      foto_url     VARCHAR(500) NULL,
      UNIQUE KEY uq_usuario_email (email),
      UNIQUE KEY uq_usuario_ra (RA),
      CONSTRAINT fk_usuario_grupo
        FOREIGN KEY (ID_grupo) REFERENCES grupo(ID_grupo)
        ON DELETE SET NULL ON UPDATE CASCADE
    ) ENGINE=InnoDB
      DEFAULT CHARSET=utf8mb4
      COLLATE=utf8mb4_unicode_ci;
  `);
}

/** Inicializa pool já apontando para o DB e garante tabelas */
export async function initDb() {
  await ensureDatabase();

  pool = await mysql.createPool({
    host: MYSQL_HOST,
    port: Number(MYSQL_PORT),
    user: MYSQL_USER,
    password: MYSQL_PASSWORD,
    database: MYSQL_DATABASE || undefined, // se vazio, ER_NO_DB_ERROR
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    multipleStatements: false, // OK (executamos queries separadas)
    charset: 'utf8mb4',        // ajuste correto de charset
  });

  // Cria tabelas (idempotente)
  await ensureTables();

  // Log do DB ativo
  try {
    const [r] = await pool.query('SELECT DATABASE() AS db');
    console.log(`🗄️  MySQL conectado. DATABASE() = ${r?.[0]?.db || '(nenhum selecionado)'}`);
  } catch (e) {
    console.error('❌ Falha ao testar conexão MySQL:', e?.message || e);
  }
  return pool;
}

/** Acesse o pool depois de initDb() */
export function getDb() {
  if (!pool) throw new Error('Pool MySQL não inicializado. Chame initDb() no bootstrap.');
  return pool;
}