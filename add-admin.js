import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import crypto from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(crypto.scrypt);

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const buf = await scryptAsync(password, salt, 64);
  return `${buf.toString("hex")}.${salt}`;
}

async function main() {
  console.log("Conectando ao banco de dados...");
  const sql = postgres(process.env.DATABASE_URL, { ssl: true });
  
  // Senha simples para facilitar o login
  const username = "admin";
  const password = "admin123";
  const hashedPassword = await hashPassword(password);
  
  try {
    console.log("Verificando se o usuário já existe...");
    const existingUser = await sql`SELECT * FROM users WHERE username = ${username}`;
    
    if (existingUser.length > 0) {
      console.log("Usuário admin já existe, atualizando senha...");
      await sql`UPDATE users 
                SET password = ${hashedPassword}
                WHERE username = ${username}`;
      console.log("Senha do usuário admin atualizada com sucesso!");
    } else {
      console.log("Criando novo usuário admin...");
      await sql`INSERT INTO users 
                (username, password, name, role, department) 
                VALUES (${username}, ${hashedPassword}, 'Administrador', 'admin', 'admin')`;
      console.log("Usuário admin criado com sucesso!");
    }
    
    console.log("\nVocê pode fazer login com:");
    console.log("Usuário: admin");
    console.log("Senha: admin123");
  } catch (error) {
    console.error("Erro ao manipular usuário:", error);
  } finally {
    await sql.end();
  }
}

main().catch(console.error);