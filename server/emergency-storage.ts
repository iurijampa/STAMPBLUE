// Armazenamento de emergência em memória
// Usado para compartilhar dados entre módulos de emergência

// Interface para a solicitação de reimpressão
export interface EmergencyReprintRequest {
  id: number;
  activityId: number;
  activityTitle?: string;
  activityImage?: string | null;
  requestedBy: string;
  reason: string;
  details?: string;
  quantity: number;
  status: string;
  createdAt: string;
  fromDepartment: string;
  toDepartment: string;
  processedBy?: string;
  processedAt?: string;
  completedBy?: string;
  completedAt?: string;
  priority?: string;
}

// Armazenamento global em memória
export const emergencyRequests: EmergencyReprintRequest[] = [];

// Interface de entrada para criação de solicitação
export interface CreateEmergencyReprintRequest {
  activityId: number;
  activityTitle?: string;
  activityImage?: string | null;
  requestedBy: string;
  reason: string;
  details?: string;
  quantity: number;
  fromDepartment: string;
  toDepartment: string;
  priority?: string;
  createdAt?: string;
}

// Funções de acesso
export function addRequest(request: EmergencyReprintRequest): EmergencyReprintRequest {
  emergencyRequests.push(request);
  console.log(`🌐 EMERGENCY STORAGE: Adicionada nova solicitação #${request.id}`);
  console.log(`🌐 EMERGENCY STORAGE: Total de solicitações: ${emergencyRequests.length}`);
  return request;
}

// Função para criar uma nova solicitação de reimpressão
export function criarSolicitacaoReimpressao(input: CreateEmergencyReprintRequest): EmergencyReprintRequest {
  const newRequest: EmergencyReprintRequest = {
    id: Date.now(), // Usar timestamp como ID
    activityId: input.activityId,
    activityTitle: input.activityTitle,
    activityImage: input.activityImage || null,
    requestedBy: input.requestedBy,
    reason: input.reason,
    details: input.details,
    quantity: input.quantity,
    status: 'pending', // Status inicial sempre pendente
    fromDepartment: input.fromDepartment,
    toDepartment: input.toDepartment,
    createdAt: input.createdAt || new Date().toISOString(),
    priority: input.priority || 'normal'
  };
  
  return addRequest(newRequest);
}

export function getAllRequests(includeCanceled: boolean = true): EmergencyReprintRequest[] {
  if (includeCanceled) {
    console.log(`🌐 EMERGENCY STORAGE: Retornando ${emergencyRequests.length} solicitações`);
    return emergencyRequests;
  } else {
    // Filtrar solicitações canceladas
    const filteredRequests = emergencyRequests.filter(req => req.status !== 'cancelada');
    console.log(`🌐 EMERGENCY STORAGE: Retornando ${filteredRequests.length} solicitações (excluindo canceladas)`);
    return filteredRequests;
  }
}

export function getRequestById(id: number): EmergencyReprintRequest | undefined {
  return emergencyRequests.find(req => req.id === id);
}

export function getRequestsForDepartment(department: string): EmergencyReprintRequest[] {
  return emergencyRequests.filter(req => req.toDepartment === department);
}

export function updateRequest(
  id: number, 
  updates: Partial<EmergencyReprintRequest>
): EmergencyReprintRequest | undefined {
  const index = emergencyRequests.findIndex(req => req.id === id);
  
  if (index === -1) {
    return undefined;
  }
  
  emergencyRequests[index] = {
    ...emergencyRequests[index],
    ...updates
  };
  
  return emergencyRequests[index];
}

export function buscarSolicitacaoPorId(id: number): EmergencyReprintRequest | undefined {
  return emergencyRequests.find(req => req.id === id);
}

export function listarSolicitacoesReimpressao(departamento?: string, includeCanceled: boolean = false): EmergencyReprintRequest[] {
  // Base de solicitações excluindo as canceladas
  const baseRequests = getAllRequests(includeCanceled);
  
  if (departamento) {
    // Se departamento for especificado, retorna apenas solicitações deste departamento
    // (tanto como origem quanto destino)
    return baseRequests.filter(
      req => req.fromDepartment === departamento || req.toDepartment === departamento
    );
  }
  // Caso contrário, retorna todas as solicitações (exceto canceladas)
  return baseRequests;
}

export function atualizarStatusSolicitacao(
  requestId: number,
  newStatus: string,
  completedBy: string,
  notes?: string
): EmergencyReprintRequest | undefined {
  const solicitacao = buscarSolicitacaoPorId(requestId);
  
  if (!solicitacao) {
    return undefined;
  }
  
  const updates: Partial<EmergencyReprintRequest> = {
    status: newStatus,
    processedBy: completedBy
  };
  
  // Adicionar data de processamento
  updates.processedAt = new Date().toISOString();
  
  // Para status concluído ou rejeitado, registra quem completou
  if (newStatus === 'completed' || newStatus === 'rejected' || 
      newStatus === 'concluida' || newStatus === 'rejeitada') {
    updates.completedBy = completedBy;
    updates.completedAt = new Date().toISOString();
  }
  
  return updateRequest(requestId, updates);
}

export function cancelarSolicitacao(
  requestId: number,
  canceledBy: string
): EmergencyReprintRequest | undefined {
  const solicitacao = buscarSolicitacaoPorId(requestId);
  
  if (!solicitacao) {
    return undefined;
  }
  
  const updates: Partial<EmergencyReprintRequest> = {
    status: 'cancelada',
    completedBy: canceledBy,
    completedAt: new Date().toISOString()
  };
  
  console.log(`🌐 EMERGENCY STORAGE: Cancelando solicitação #${requestId} por ${canceledBy}`);
  
  return updateRequest(requestId, updates);
}