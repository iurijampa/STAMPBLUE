// Dados de emergência injetados diretamente no código
// Usado como backup quando a API não está funcionando

export interface EmergencyRequest {
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

// Array de solicitações de emergência (vazio para produção)
export const emergencyRequests: EmergencyRequest[] = [];