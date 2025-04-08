import 'dotenv/config';
import { db } from './db';
import { DatabaseStorage } from './database-storage';
import { users, DEPARTMENTS } from '@shared/schema';

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
    
    // Usar o storage para criar usuários (pois ele lida com o hash de senhas)
    const storage = new DatabaseStorage();
    
    // Executar método de inicialização de usuários
    await (storage as any).initializeDefaultUsers();
    
    console.log("🎉 Banco de dados inicializado com sucesso!");
    
  } catch (error) {
    console.error("❌ Erro ao inicializar banco de dados:", error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

main();