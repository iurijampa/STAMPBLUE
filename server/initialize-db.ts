import 'dotenv/config';
import { sql, db } from './db';
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";
import { users, DEPARTMENTS } from '@shared/schema';

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function main() {
  try {
    console.log("🔧 Verificando banco de dados...");
    
    // Verificar se já existem usuários
    const existingUsers = await db.select().from(users);
    
    if (existingUsers.length > 0) {
      console.log("✅ Banco de dados já está inicializado com usuários");
      return;
    }
    
    console.log("⚠️ Nenhum usuário encontrado. Inicializando banco de dados...");
    
    // Criar usuário admin padrão
    const adminUser = await db.insert(users).values({
      username: "admin",
      password: await hashPassword("admin"),
      name: "Administrador",
      role: "admin",
      department: "admin"
    }).returning();
    console.log("✓ Usuário admin criado");
    
    // Criar usuários para cada departamento (em paralelo para maior velocidade)
    const defaultPassword = await hashPassword("123456");
    
    const departmentPromises = DEPARTMENTS.map(async (dept) => {
      if (dept === "admin") return; // Admin já foi criado
      
      return db.insert(users).values({
        username: dept,
        password: defaultPassword,
        name: dept.charAt(0).toUpperCase() + dept.slice(1),
        role: dept,
        department: dept
      });
    }).filter(Boolean);
    
    await Promise.all(departmentPromises);
    console.log(`✓ ${departmentPromises.length} usuários de departamento criados`);
    
    console.log("🎉 Banco de dados inicializado com sucesso!");
    
  } catch (error) {
    console.error("❌ Erro ao inicializar banco de dados:", error);
    process.exit(1);
  } finally {
    // Feche a conexão com o banco de dados
    await sql.end();
    process.exit(0);
  }
}

main();