import { drizzle } from "drizzle-orm/neon-serverless";
import { neon, neonConfig } from "@neondatabase/serverless";
import * as schema from "@shared/schema";

// Configuração para garantir que conexões sejam reutilizadas
neonConfig.fetchConnectionCache = true;

// Cliente SQL para consultas diretas e Drizzle para ORM
export const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle(sql, { schema });

// Função auxiliar para criar um cliente de pool de conexões
export async function withPool<T>(callback: () => Promise<T>): Promise<T> {
  try {
    return await callback();
  } catch (error) {
    console.error("Erro na operação do banco:", error);
    throw error;
  }
}