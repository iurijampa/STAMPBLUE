import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Activity } from "@shared/schema";
import { Loader2, RefreshCw, ClipboardList } from "lucide-react";
import ViewReprintRequestModal from "@/components/view-reprint-request-modal";

interface ReprintRequest {
  id: number;
  activityId: number;
  activityTitle?: string; // Adicionado pelo backend
  requestedBy: string;
  reason: string;
  details?: string;
  quantity: number;
  priority: "low" | "normal" | "high" | "urgent";
  status: "pending" | "in_progress" | "completed" | "rejected";
  requestedAt: string;
  completedBy?: string;
  completedAt?: string;
  receivedBy?: string;
  receivedAt?: string;
}

const statusLabels = {
  pending: "Pendente",
  in_progress: "Em andamento",
  completed: "Concluído",
  rejected: "Rejeitado"
};

const statusColors = {
  pending: "bg-yellow-500",
  in_progress: "bg-blue-500",
  completed: "bg-green-500",
  rejected: "bg-red-500"
};

const priorityLabels = {
  low: "Baixa",
  normal: "Normal",
  high: "Alta",
  urgent: "Urgente"
};

const priorityColors = {
  low: "bg-slate-500",
  normal: "bg-blue-500",
  high: "bg-amber-500",
  urgent: "bg-red-500"
};

interface ReprintRequestsListProps {
  department: string;
}

export default function ReprintRequestsList({ department }: ReprintRequestsListProps) {
  const [viewRequest, setViewRequest] = useState<ReprintRequest | null>(null);
  
  // Buscar solicitações feitas pelo departamento atual
  const { 
    data: reprintRequests = [], 
    isLoading, 
    refetch 
  } = useQuery({
    queryKey: ["/api/reprint-requests/from-department", department],
    queryFn: async () => {
      const response = await fetch(`/api/reprint-requests/from-department/${department}`, {
        credentials: 'include',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      if (!response.ok) {
        throw new Error('Erro ao buscar solicitações de reimpressão');
      }
      
      return await response.json() as ReprintRequest[];
    },
    enabled: !!department,
    staleTime: 30000,
    refetchOnWindowFocus: false
  });
  
  // Função para formatar a data
  const formatDate = (dateString: string) => {
    if (!dateString) return "Não informado";
    return new Date(dateString).toLocaleDateString('pt-BR');
  };
  
  // Agrupar solicitações por status para melhor visualização
  const pendingRequests = reprintRequests.filter(req => 
    req.status === 'pending' || req.status === 'in_progress'
  );
  
  const completedRequests = reprintRequests.filter(req => 
    req.status === 'completed' || req.status === 'rejected'
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Solicitações de Reimpressão</h3>
        <Button 
          size="sm" 
          variant="outline" 
          onClick={() => refetch()}
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          <span className="ml-2">Atualizar</span>
        </Button>
      </div>
      
      {isLoading ? (
        <div className="py-4 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground mt-2">Carregando solicitações...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Solicitações pendentes/em andamento */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Solicitações Ativas</CardTitle>
              <CardDescription>
                Solicitações pendentes ou em processamento
              </CardDescription>
            </CardHeader>
            <CardContent>
              {pendingRequests.length > 0 ? (
                <div className="space-y-4">
                  {pendingRequests.map(request => (
                    <div key={request.id} className="border rounded-md p-4">
                      <div className="flex justify-between">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">{request.activityTitle || `Atividade #${request.activityId}`}</h4>
                            <Badge className={statusColors[request.status]}>
                              {statusLabels[request.status]}
                            </Badge>
                            <Badge className={priorityColors[request.priority]}>
                              {priorityLabels[request.priority]}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            Motivo: {request.reason}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
                            <span>Solicitado por: {request.requestedBy}</span>
                            <span>Data: {formatDate(request.requestedAt)}</span>
                            <span>Quantidade: {request.quantity}</span>
                          </div>
                        </div>
                        <div>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => setViewRequest(request)}
                          >
                            <ClipboardList className="h-4 w-4 mr-1" />
                            <span>Detalhes</span>
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhuma solicitação ativa no momento.
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Solicitações concluídas/rejeitadas */}
          {completedRequests.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Histórico de Solicitações</CardTitle>
                <CardDescription>
                  Solicitações concluídas ou rejeitadas
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {completedRequests.map(request => (
                    <div key={request.id} className="border rounded-md p-4">
                      <div className="flex justify-between">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">{request.activityTitle || `Atividade #${request.activityId}`}</h4>
                            <Badge className={`${statusColors[request.status]} ${request.status === 'completed' ? 'bg-opacity-80' : ''}`}>
                              {statusLabels[request.status]}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            Motivo: {request.reason}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
                            <span>Solicitado por: {request.requestedBy}</span>
                            <span>Data: {formatDate(request.requestedAt)}</span>
                            {request.completedBy && (
                              <span>Processado por: {request.completedBy}</span>
                            )}
                            {request.completedAt && (
                              <span>Concluído em: {formatDate(request.completedAt)}</span>
                            )}
                          </div>
                        </div>
                        <div>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => setViewRequest(request)}
                          >
                            <ClipboardList className="h-4 w-4 mr-1" />
                            <span>Detalhes</span>
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
          
          {reprintRequests.length === 0 && !isLoading && (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma solicitação de reimpressão encontrada.
            </div>
          )}
        </div>
      )}
      
      {/* Modal para visualizar detalhes da solicitação */}
      <ViewReprintRequestModal
        isOpen={!!viewRequest}
        onClose={() => setViewRequest(null)}
        request={viewRequest}
      />
    </div>
  );
}