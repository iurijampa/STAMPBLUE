import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Activity } from "@shared/schema";
import { Loader2, RefreshCw, ClipboardList, CheckCircle, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface ReprintRequest {
  id: number;
  activityId: number;
  activityTitle?: string;
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

interface ReprintRequestsForDepartmentProps {
  department: string;
}

// Componente de modal para processar uma solicitação (completar ou rejeitar)
const ProcessRequestModal = ({ 
  isOpen, 
  onClose, 
  request, 
  onSuccess 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  request: ReprintRequest | null;
  onSuccess: () => void;
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [processedBy, setProcessedBy] = useState("");
  const [notes, setNotes] = useState("");
  const [action, setAction] = useState<"completed" | "rejected">("completed");
  
  // Mutation para atualizar o status da solicitação
  const updateStatusMutation = useMutation({
    mutationFn: async (data: {
      requestId: number;
      status: "completed" | "rejected";
      processedBy: string;
      notes?: string;
    }) => {
      const response = await apiRequest("PATCH", `/api/reprint-requests/${data.requestId}/status`, {
        status: data.status,
        processedBy: data.processedBy,
        notes: data.notes
      });
      return response.json();
    },
    onSuccess: () => {
      // Invalidar cache das solicitações
      queryClient.invalidateQueries({ queryKey: ["/api/reprint-requests/for-department"] });
      
      // Notificar usuário
      toast({
        title: `Solicitação ${action === "completed" ? "concluída" : "rejeitada"} com sucesso`,
        description: `A solicitação foi marcada como ${
          action === "completed" ? "concluída" : "rejeitada"
        } e o setor de batida será notificado.`,
      });
      
      // Fechar modal e chamar callback de sucesso
      onClose();
      onSuccess();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao processar solicitação",
        description: error.message || "Ocorreu um erro ao processar a solicitação. Tente novamente.",
        variant: "destructive",
      });
    }
  });
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validação básica
    if (!processedBy.trim()) {
      toast({
        title: "Campo obrigatório",
        description: "Informe quem está processando a solicitação.",
        variant: "destructive",
      });
      return;
    }
    
    if (!request) {
      toast({
        title: "Erro",
        description: "Nenhuma solicitação selecionada.",
        variant: "destructive",
      });
      return;
    }
    
    // Atualizar status
    updateStatusMutation.mutate({
      requestId: request.id,
      status: action,
      processedBy,
      notes: notes || undefined
    });
  };
  
  if (!request) return null;
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Processar Solicitação de Reimpressão</DialogTitle>
          <DialogDescription>
            {request.activityTitle || `Atividade #${request.activityId}`}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div>
            <h4 className="text-sm font-medium mb-2">Detalhes da solicitação</h4>
            <p className="text-sm">
              <span className="font-medium">Solicitado por:</span> {request.requestedBy}
            </p>
            <p className="text-sm">
              <span className="font-medium">Motivo:</span> {request.reason}
            </p>
            <p className="text-sm">
              <span className="font-medium">Quantidade:</span> {request.quantity}
            </p>
            <p className="text-sm">
              <span className="font-medium">Prioridade:</span> {priorityLabels[request.priority]}
            </p>
            {request.details && (
              <p className="text-sm">
                <span className="font-medium">Detalhes:</span> {request.details}
              </p>
            )}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="action">Ação</Label>
            <div className="flex space-x-4">
              <div className="flex items-center">
                <input
                  type="radio"
                  id="completed"
                  name="action"
                  className="mr-2"
                  checked={action === "completed"}
                  onChange={() => setAction("completed")}
                />
                <Label htmlFor="completed">Concluir reimpressão</Label>
              </div>
              <div className="flex items-center">
                <input
                  type="radio"
                  id="rejected"
                  name="action"
                  className="mr-2"
                  checked={action === "rejected"}
                  onChange={() => setAction("rejected")}
                />
                <Label htmlFor="rejected">Rejeitar solicitação</Label>
              </div>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="processedBy">Processado por *</Label>
            <Input
              id="processedBy"
              placeholder="Seu nome"
              value={processedBy}
              onChange={(e) => setProcessedBy(e.target.value)}
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="notes">Observações (opcional)</Label>
            <Textarea
              id="notes"
              placeholder="Detalhes adicionais sobre o processamento"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
          
          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={updateStatusMutation.isPending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={updateStatusMutation.isPending}>
              {updateStatusMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processando...
                </>
              ) : (
                action === "completed" ? 'Concluir Reimpressão' : 'Rejeitar Solicitação'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default function ReprintRequestsForDepartment({ department }: ReprintRequestsForDepartmentProps) {
  const { toast } = useToast();
  const [selectedRequest, setSelectedRequest] = useState<ReprintRequest | null>(null);
  
  // Buscar solicitações para o departamento atual
  const { 
    data: reprintRequests = [], 
    isLoading, 
    refetch 
  } = useQuery({
    queryKey: ["/api/reprint-requests/for-department", department],
    queryFn: async () => {
      const response = await fetch(`/api/reprint-requests/for-department/${department}`, {
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
    req.status === 'pending'
  );
  
  const inProgressRequests = reprintRequests.filter(req => 
    req.status === 'in_progress'
  );
  
  const completedRequests = reprintRequests.filter(req => 
    req.status === 'completed' || req.status === 'rejected'
  );
  
  // Processar o sucesso de uma atualização
  const handleRequestProcessed = () => {
    refetch();
  };
  
  // Atualizar status para "em andamento"
  const startProcessingMutation = useMutation({
    mutationFn: async (requestId: number) => {
      const response = await apiRequest("PATCH", `/api/reprint-requests/${requestId}/status`, {
        status: "in_progress"
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Solicitação iniciada",
        description: "A solicitação foi marcada como em andamento.",
      });
      refetch();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao iniciar processamento",
        description: error.message || "Ocorreu um erro ao atualizar o status da solicitação.",
        variant: "destructive",
      });
    }
  });
  
  const handleStartProcessing = (request: ReprintRequest) => {
    startProcessingMutation.mutate(request.id);
  };
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-2">
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
            <RefreshCw className="h-4 w-4 mr-1" />
          )}
          <span>Atualizar</span>
        </Button>
      </div>
      
      {isLoading ? (
        <div className="py-4 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground mt-2">Carregando solicitações...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Solicitações pendentes */}
          {pendingRequests.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Solicitações Pendentes</CardTitle>
                <CardDescription>
                  Novas solicitações que precisam ser processadas
                </CardDescription>
              </CardHeader>
              <CardContent>
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
                        <div className="flex flex-col gap-2">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => setSelectedRequest(request)}
                            className="flex items-center"
                          >
                            <ClipboardList className="h-4 w-4 mr-1" />
                            <span>Processar</span>
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleStartProcessing(request)}
                            className="flex items-center"
                          >
                            <span>Iniciar Produção</span>
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* Solicitações em andamento */}
          {inProgressRequests.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Em Andamento</CardTitle>
                <CardDescription>
                  Solicitações que já estão sendo processadas
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {inProgressRequests.map(request => (
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
                        <div className="flex flex-col gap-2">
                          <Button 
                            variant="default" 
                            size="sm"
                            onClick={() => setSelectedRequest(request)}
                            className="flex items-center"
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            <span>Concluir</span>
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* Solicitações concluídas/rejeitadas */}
          {completedRequests.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Histórico</CardTitle>
                <CardDescription>
                  Solicitações concluídas ou rejeitadas
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {completedRequests.map(request => (
                    <div key={request.id} className="border rounded-md p-4 opacity-80">
                      <div className="flex justify-between">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">{request.activityTitle || `Atividade #${request.activityId}`}</h4>
                            <Badge className={statusColors[request.status]}>
                              {statusLabels[request.status]}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            Motivo: {request.reason}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
                            <span>Processado por: {request.completedBy || "Não informado"}</span>
                            <span>Concluído em: {formatDate(request.completedAt || "")}</span>
                          </div>
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
              Nenhuma solicitação de reimpressão encontrada para o seu departamento.
            </div>
          )}
        </div>
      )}
      
      {/* Modal para processar solicitação */}
      <ProcessRequestModal
        isOpen={!!selectedRequest}
        onClose={() => setSelectedRequest(null)}
        request={selectedRequest}
        onSuccess={handleRequestProcessed}
      />
    </div>
  );
}