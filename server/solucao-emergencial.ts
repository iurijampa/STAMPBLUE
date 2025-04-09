import { db } from "./db";
import { activities, activityProgress, DEPARTMENTS } from "@shared/schema"; 
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

// Função emergencial para criar registro de progresso para o próximo departamento
export async function criarProgressoProximoDepartamentoEmergencia(
  activityId: number, 
  departmentAtual: string
) {
  try {
    console.log(`[EMERGENCIA] Criando progresso para o próximo departamento após ${departmentAtual}`);
    
    // Encontrar o índice do departamento atual
    const departmentIndex = DEPARTMENTS.indexOf(departmentAtual as any);
    
    // Verificar se existe um próximo departamento
    if (departmentIndex < 0 || departmentIndex >= DEPARTMENTS.length - 1) {
      console.log("[EMERGENCIA] Não há próximo departamento, este é o último");
      return null;
    }
    
    // Obter o próximo departamento
    const proximoDepartamento = DEPARTMENTS[departmentIndex + 1];
    console.log(`[EMERGENCIA] Próximo departamento: ${proximoDepartamento}`);
    
    // Verificar se já existe um registro de progresso para este departamento
    const progressoExistente = await db
      .select()
      .from(activityProgress)
      .where(
        and(
          eq(activityProgress.activityId, activityId),
          eq(activityProgress.department, proximoDepartamento as any)
        )
      );
    
    if (progressoExistente.length > 0) {
      console.log(`[EMERGENCIA] Já existe um registro de progresso para ${proximoDepartamento}`);
      
      // Se o registro já existe, precisamos verificar seu status e atualizá-lo para "pending" caso esteja como "completed"
      // Isso garante que quando um item retornado e depois enviado novamente, volta a aparecer para o próximo departamento
      if (progressoExistente[0].status === "completed") {
        console.log(`[EMERGENCIA] O progresso existente está como "completed", atualizando para "pending"`);
        
        // Atualizar o registro existente para "pending"
        const [progressoAtualizado] = await db
          .update(activityProgress)
          .set({
            status: "pending",
            completedBy: null,
            completedAt: null,
            notes: null,
            returnedBy: null,
            returnedAt: null
          })
          .where(eq(activityProgress.id, progressoExistente[0].id))
          .returning();
          
        return progressoAtualizado;
      }
      
      return progressoExistente[0];
    }
    
    // Criar novo registro de progresso
    const [novoProgresso] = await db
      .insert(activityProgress)
      .values({
        activityId,
        department: proximoDepartamento as any,
        status: "pending",
        completedBy: null,
        completedAt: null,
        notes: null,
        returnedBy: null,
        returnedAt: null
      })
      .returning();
    
    console.log(`[EMERGENCIA] Criado novo progresso para ${proximoDepartamento} com sucesso!`);
    return novoProgresso;
  } catch (erro) {
    console.error(`[EMERGENCIA] Erro ao criar progresso para o próximo departamento:`, erro);
    throw erro;
  }
}

// Função para completar um progresso de atividade em departamento (modo emergencial)
export async function completarProgressoAtividadeEmergencia(
  activityId: number,
  department: string,
  completedBy: string,
  notes?: string
) {
  try {
    console.log(`[EMERGENCIA] Marcando atividade ${activityId} como concluída no departamento ${department}`);
    
    // Buscar o progresso atual
    const progressoAtual = await db
      .select()
      .from(activityProgress)
      .where(
        and(
          eq(activityProgress.activityId, activityId),
          eq(activityProgress.department, department as any)
        )
      );
    
    if (progressoAtual.length === 0) {
      throw new Error(`Progresso não encontrado para atividade ${activityId} no departamento ${department}`);
    }
    
    // Atualizar o progresso para concluído
    const [progressoAtualizado] = await db
      .update(activityProgress)
      .set({
        status: "completed",
        completedBy,
        completedAt: new Date(),
        notes: notes || null
      })
      .where(eq(activityProgress.id, progressoAtual[0].id))
      .returning();
    
    console.log(`[EMERGENCIA] Atividade ${activityId} marcada como concluída com sucesso no departamento ${department}`);
    
    // Criar progresso para o próximo departamento
    await criarProgressoProximoDepartamentoEmergencia(activityId, department);
    
    return progressoAtualizado;
  } catch (erro) {
    console.error(`[EMERGENCIA] Erro ao completar atividade:`, erro);
    throw erro;
  }
}