import "dotenv/config";
import mysql from "mysql2/promise";

const { MYSQLHOST, MYSQLPORT, MYSQLUSER, MYSQLPASSWORD, MYSQLDATABASE } =
  process.env;

const testConnection = async () => {
  try {
    const conn = await mysql.createConnection({
      host: MYSQLHOST,
      user: MYSQLUSER,
      port: Number(MYSQLPORT),
      password: MYSQLPASSWORD,
      database: MYSQLDATABASE,
    });

    const [rows] = await conn.query("SELECT NOW() AS agora");
    console.log("✅ Conectado ao Railway(MySQL) • Data/Hora:", rows[0].agora);

    await conn.end();
  } catch (err) {
    console.error("❌ Erro ao conectar no Railway(MySQL):", err.message);
    process.exit(1);
  }
};

testConnection();
