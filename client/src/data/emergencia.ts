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

// Array de solicitações de emergência
export const emergencyRequests: EmergencyRequest[] = [
  {
    id: 1001,
    activityId: 48,
    activityTitle: "GS IPHONE - Dados Fixos",
    activityImage: "/uploads/activity_48.jpg",
    requestedBy: "Dados Fixos",
    reason: "Teste de exibição de imagem com dados injetados",
    details: "Esta é uma solicitação de teste criada diretamente no código",
    quantity: 3,
    status: "pendente",
    createdAt: new Date().toISOString(),
    fromDepartment: "batida",
    toDepartment: "impressao"
  },
  {
    id: 1002,
    activityId: 47,
    activityTitle: "LUCIANO BRITO - Dados Fixos",
    activityImage: "/uploads/activity_47.jpg",
    requestedBy: "Dados Fixos",
    reason: "Segunda solicitação de teste fixa",
    details: "Esta é outra solicitação de teste criada diretamente no código",
    quantity: 5,
    status: "pendente",
    createdAt: new Date().toISOString(),
    fromDepartment: "batida",
    toDepartment: "impressao"
  }
];