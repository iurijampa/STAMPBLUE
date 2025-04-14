/**
 * Ponte de compatibilidade entre o sistema antigo de reimpressão e o novo sistema baseado em banco de dados
 * Este arquivo garante que as APIs antigas continuem funcionando enquanto migramos para o novo sistema
 */

import { eq } from 'drizzle-orm';
import { db } from './db';
import { reprintRequests } from '@shared/schema';

/**
 * Interface de resposta compatível com o sistema legado
 */
interface ReprintRequest {
  id: number;
  activityId: number;
  activityTitle?: string;
  requestedBy: string;
  reason: string;
  details?: string;
  quantity: number;
  priority: string;
  status: string;
  requestedAt: string;
  completedBy?: string | null;
  completedAt?: string | null;
  receivedBy?: string | null;
  receivedAt?: string | null;
  fromDepartment: string;
  toDepartment: string;
}

/**
 * Busca todas as solicitações de reimpressão do banco de dados e converte para o formato legado
 */
export async function listarSolicitacoesReimpressao(departamento?: string, incluirCanceladas = true): Promise<ReprintRequest[]> {
  try {
    console.log('🔄 [BRIDGE] Buscando solicitações de reimpressão do banco de dados');
    
    // Buscar solicitações do banco de dados
    const dbRequests = await db.select().from(reprintRequests).orderBy(reprintRequests.requestedAt);
    
    // Mapear para o formato legado
    const mappedRequests = dbRequests.map(request => ({
      id: request.id,
      activityId: request.activityId,
      requestedBy: request.requestedBy,
      reason: request.reason,
      details: request.details || '',
      quantity: request.quantity,
      priority: request.priority,
      // Converter status para o formato legado
      status: request.status === 'pending' ? 'pendente' : 
              request.status === 'in_progress' ? 'em_andamento' : 
              request.status === 'completed' ? 'concluida' : 'rejeitada',
      requestedAt: request.requestedAt.toISOString(),
      completedBy: request.completedBy,
      completedAt: request.completedAt ? request.completedAt.toISOString() : null,
      receivedBy: null, // Campo legado
      receivedAt: null, // Campo legado
      fromDepartment: request.fromDepartment,
      toDepartment: request.toDepartment,
    }));
    
    // Filtrar por departamento se especificado
    const filteredRequests = departamento 
      ? mappedRequests.filter(req => req.toDepartment === departamento)
      : mappedRequests;
    
    // Filtrar solicitações canceladas se necessário
    const finalRequests = incluirCanceladas 
      ? filteredRequests 
      : filteredRequests.filter(req => req.status !== 'rejeitada');
    
    console.log(`🔄 [BRIDGE] Retornando ${finalRequests.length} solicitações de reimpressão`);
    return finalRequests;
  } catch (error) {
    console.error('🚨 [BRIDGE] Erro ao buscar solicitações de reimpressão:', error);
    return [];
  }
}

/**
 * Cria uma nova solicitação de reimpressão no banco de dados
 */
export async function criarSolicitacaoReimpressao(data: any) {
  try {
    console.log('🔄 [BRIDGE] Criando solicitação de reimpressão no banco de dados');
    
    // Inserir no banco de dados
    const [createdRequest] = await db
      .insert(reprintRequests)
      .values({
        activityId: data.activityId,
        requestedBy: data.requestedBy,
        fromDepartment: data.fromDepartment,
        toDepartment: data.toDepartment,
        reason: data.reason,
        details: data.details || null,
        quantity: data.quantity,
        priority: data.priority || 'normal', // Valor padrão para evitar erros
      })
      .returning();
    
    console.log(`🔄 [BRIDGE] Solicitação criada com sucesso: #${createdRequest.id}`);
    return {
      success: true,
      message: "Solicitação de reimpressão criada com sucesso",
      id: createdRequest.id
    };
  } catch (error) {
    console.error('🚨 [BRIDGE] Erro ao criar solicitação de reimpressão:', error);
    return {
      success: false,
      message: `Erro ao criar solicitação: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
    };
  }
}

/**
 * Processa uma solicitação de reimpressão (atualiza o status)
 */
export async function processarSolicitacaoReimpressao(id: number, data: any) {
  try {
    console.log(`🔄 [BRIDGE] Processando solicitação #${id} - novo status: ${data.status}`);
    
    // Converter o status do formato legado para o formato do banco
    const dbStatus = data.status === 'concluida' ? 'completed' : 
                     data.status === 'em_andamento' ? 'in_progress' : 
                     data.status === 'rejeitada' ? 'rejected' : 'pending';
    
    // Atualizar no banco de dados
    const [updatedRequest] = await db
      .update(reprintRequests)
      .set({
        status: dbStatus,
        completedBy: data.completedBy || null,
        completedAt: dbStatus === 'completed' || dbStatus === 'rejected' ? new Date() : null,
      })
      .where(eq(reprintRequests.id, id))
      .returning();
    
    if (!updatedRequest) {
      throw new Error(`Solicitação #${id} não encontrada`);
    }
    
    console.log(`🔄 [BRIDGE] Solicitação #${id} processada com sucesso`);
    return {
      success: true,
      message: "Solicitação processada com sucesso",
    };
  } catch (error) {
    console.error(`🚨 [BRIDGE] Erro ao processar solicitação #${id}:`, error);
    return {
      success: false,
      message: `Erro ao processar solicitação: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
    };
  }
}