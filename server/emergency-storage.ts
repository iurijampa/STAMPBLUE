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
}

// Armazenamento global em memória
export const emergencyRequests: EmergencyReprintRequest[] = [];

// Funções de acesso
export function addRequest(request: EmergencyReprintRequest): EmergencyReprintRequest {
  emergencyRequests.push(request);
  console.log(`🌐 EMERGENCY STORAGE: Adicionada nova solicitação #${request.id}`);
  console.log(`🌐 EMERGENCY STORAGE: Total de solicitações: ${emergencyRequests.length}`);
  return request;
}

export function getAllRequests(): EmergencyReprintRequest[] {
  console.log(`🌐 EMERGENCY STORAGE: Retornando ${emergencyRequests.length} solicitações`);
  return emergencyRequests;
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