import { db } from "./db";
import { activities, activityProgress } from "@shared/schema"; 
import { and, eq } from "drizzle-orm";

// Função de emergência para buscar atividades pendentes por departamento
// Esta função ignora o uso de cache e faz consultas diretas e seguras ao banco
export async function buscarAtividadesPorDepartamentoEmergencia(department: string) {
  console.log(`[EMERGENCIA] Buscando atividades pendentes para: ${department}`);
  
  try {
    // ETAPA 1: Buscar os registros de progresso pendentes para este departamento
    const progressos = await db
      .select()
      .from(activityProgress)
      .where(
        and(
          eq(activityProgress.department, department as any),
          eq(activityProgress.status, "pending")
        )
      );
      
    console.log(`[EMERGENCIA] Encontrados ${progressos.length} progresso(s) pendente(s) para ${department}`);
    
    if (progressos.length === 0) {
      return [];
    }
    
    // ETAPA 2: Buscar detalhes das atividades correspondentes
    const resultado = [];
    
    // Processar cada progresso individualmente para maior segurança
    for (const progresso of progressos) {
      try {
        // Consulta segura por ID individual, evitando problemas de sintaxe SQL
        const atividades = await db
          .select()
          .from(activities)
          .where(eq(activities.id, progresso.activityId));
          
        if (atividades.length > 0) {
          resultado.push(atividades[0]);
          console.log(`[EMERGENCIA] Atividade adicionada: ${atividades[0].id} - ${atividades[0].title}`);
        }
      } catch (err) {
        console.error(`[EMERGENCIA] Erro ao buscar atividade ${progresso.activityId}:`, err);
        // Continuar com os próximos registros
      }
    }
    
    console.log(`[EMERGENCIA] Total de ${resultado.length} atividades recuperadas para ${department}`);
    
    // ETAPA 3: Ordenar por deadline (mais urgentes primeiro)
    return resultado.sort((a, b) => {
      if (!a.deadline) return 1;
      if (!b.deadline) return -1;
      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
    });
  } catch (erro) {
    console.error(`[EMERGENCIA] Erro crítico ao buscar atividades para ${department}:`, erro);
    // Retornar array vazio em caso de erro para não quebrar a aplicação
    return [];
  }
}