import { Activity } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import { Loader2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

// Interface para representar a solicitação de reimpressão
interface ReprintRequest {
  id: number;
  activityId: number;
  activityTitle?: string;
  activityImage?: string;
  requestedBy: string;
  reason: string;
  details?: string;
  quantity: number;
  priority: "low" | "normal" | "high" | "urgent";
  status: "pending" | "in_progress" | "completed" | "rejected" | "pendente" | "em_andamento" | "concluida" | "rejeitada";
  requestedAt?: string;
  createdAt: string;
  completedBy?: string;
  completedAt?: string;
  receivedBy?: string;
  receivedAt?: string;
  fromDepartment: string;
  toDepartment: string;
}

interface ViewReprintRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: ReprintRequest;
}

export default function ViewReprintRequestModal({ isOpen, onClose, request }: ViewReprintRequestModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedBy, setProcessedBy] = useState("");
  const [responseNotes, setResponseNotes] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");

  // Verificar se o usuário atual pertence ao departamento que recebe a solicitação
  const canProcess = user?.role === request.toDepartment;

  // Mutação para atualizar o status da solicitação usando API emergencial
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, processedBy, responseNotes }: { 
      id: number; 
      status: string; 
      processedBy: string; 
      responseNotes?: string;
    }) => {
      // Usando a API emergencial em vez da original
      const response = await fetch(`/api/reimpressao-emergencial/${id}/processar`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status,
          processedBy,
          responseNotes
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Erro ao atualizar solicitação");
      }
      
      return await response.json();
    },
    onSuccess: () => {
      setIsProcessing(false);
      // Forçar atualização imediata de todas as listas de solicitações
      queryClient.invalidateQueries({
        queryKey: ["/api/reimpressao-emergencial/listar"],
        refetchType: 'all'
      });
      // Mostrar notificação de sucesso
      toast({
        title: "Solicitação atualizada",
        description: "Status da solicitação atualizado com sucesso.",
      });
      onClose();
    },
    onError: (error: Error) => {
      setIsProcessing(false);
      toast({
        title: "Erro ao atualizar solicitação",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Mutação para cancelar a solicitação
  const cancelRequestMutation = useMutation({
    mutationFn: async ({ id, canceledBy }: { 
      id: number; 
      canceledBy: string; 
    }) => {
      const response = await fetch(`/api/reimpressao-emergencial/${id}/cancelar`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          canceledBy
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Erro ao cancelar solicitação");
      }
      
      return await response.json();
    },
    onSuccess: () => {
      setIsProcessing(false);
      // Forçar atualização imediata de todas as listas de solicitações
      queryClient.invalidateQueries({
        queryKey: ["/api/reimpressao-emergencial/listar"],
        refetchType: 'all'
      });
      // Mostrar notificação de sucesso
      toast({
        title: "Solicitação cancelada",
        description: "A solicitação de reimpressão foi cancelada com sucesso.",
      });
      onClose();
    },
    onError: (error: Error) => {
      setIsProcessing(false);
      toast({
        title: "Erro ao cancelar solicitação",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Função para lidar com a atualização do status
  const handleUpdateStatus = (status: string) => {
    if (!processedBy) {
      toast({
        title: "Informação necessária",
        description: "Informe quem está processando esta solicitação.",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    updateStatusMutation.mutate({
      id: request.id,
      status,
      processedBy,
      responseNotes,
    });
  };
  
  // Função para lidar com o cancelamento da solicitação
  const handleCancelRequest = () => {
    // Solicitar confirmação antes de cancelar
    if (!window.confirm("Tem certeza que deseja cancelar esta solicitação de reimpressão?")) {
      return;
    }
    
    // Verificar se tem nome de quem está cancelando
    let nomeCancelamento = processedBy;
    
    // Se não tiver preenchido, pede diretamente
    if (!nomeCancelamento || nomeCancelamento.trim() === '') {
      nomeCancelamento = prompt("Digite seu nome para confirmar o cancelamento:") || "";
      
      if (!nomeCancelamento || nomeCancelamento.trim() === '') {
        toast({
          title: "Informação necessária",
          description: "É necessário informar seu nome para cancelar a solicitação.",
          variant: "destructive",
        });
        return;
      }
    }
    
    setIsProcessing(true);
    cancelRequestMutation.mutate({
      id: request.id,
      canceledBy: nomeCancelamento,
    });
  };

  // Formatação da prioridade e status
  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'low':
        return <Badge variant="outline">Baixa</Badge>;
      case 'normal':
        return <Badge variant="secondary">Normal</Badge>;
      case 'high':
        return <Badge variant="default">Alta</Badge>;
      case 'urgent':
        return <Badge variant="destructive">Urgente</Badge>;
      default:
        return <Badge variant="secondary">Normal</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
      case 'pendente':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700">Pendente</Badge>;
      case 'in_progress':
      case 'em_andamento':
        return <Badge variant="secondary" className="bg-blue-50 text-blue-700">Em Processo</Badge>;
      case 'completed':
      case 'concluida':
        return <Badge variant="default" className="bg-green-50 text-green-700">Concluída</Badge>;
      case 'rejected':
      case 'rejeitada':
        return <Badge variant="destructive">Rejeitada</Badge>;
      default:
        console.log('Status desconhecido no modal:', status);
        return <Badge variant="outline">Desconhecido</Badge>;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Detalhes da Solicitação de Reimpressão</DialogTitle>
          <DialogDescription>
            Detalhes completos da solicitação para o pedido {request.activityTitle || `#${request.activityId}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex justify-between">
                <div className="flex items-start gap-3">
                  {/* Imagem da atividade como miniatura */}
                  <div className="flex-shrink-0 w-36 h-36 rounded-md overflow-hidden border bg-slate-50 flex items-center justify-center">
                    {request.activityImage && request.activityImage.startsWith('data:') ? (
                      // Se temos uma string base64, usar diretamente
                      <div className="relative w-full h-full">
                        <img 
                          src={request.activityImage}
                          alt={request.activityTitle || `Pedido ${request.activityId}`} 
                          className="w-full h-full object-contain"
                          style={{ imageRendering: 'auto' }}
                          onError={(e) => {
                            console.log('Erro ao carregar imagem base64 no modal, usando ícone.');
                            e.currentTarget.onerror = null; // Previne loop infinito
                            e.currentTarget.src = "/no-image.svg";
                          }}
                        />
                        <div className="absolute bottom-0 right-0 p-1 bg-black bg-opacity-50 text-white text-xs rounded-tl">
                          Base64
                        </div>
                      </div>
                    ) : request.activityImage ? (
                      // Se temos uma URL ou caminho, usar isso
                      <div className="relative w-full h-full">
                        <img 
                          src={request.activityImage}
                          alt={request.activityTitle || `Pedido ${request.activityId}`} 
                          className="w-full h-full object-contain"
                          onError={(e) => {
                            console.log('Erro ao carregar imagem no modal, tentando API:', e.currentTarget.src);
                            if (!e.currentTarget.src.includes('/api/')) {
                              e.currentTarget.src = `/api/activity-image/${request.activityId}`;
                            } else {
                              e.currentTarget.onerror = null; // Previne loop infinito
                              e.currentTarget.src = "/no-image.svg";
                            }
                          }}
                        />
                        <div className="absolute bottom-0 right-0 p-1 bg-black bg-opacity-50 text-white text-xs rounded-tl">
                          URL
                        </div>
                      </div>
                    ) : (
                      // Última alternativa: tentar várias fontes em sequência
                      <div className="relative w-full h-full">
                        <img 
                          src={`/uploads/activity_${request.activityId}.jpg`}
                          alt={request.activityTitle || `Pedido ${request.activityId}`} 
                          className="w-full h-full object-contain"
                          onError={(e) => {
                            console.log('Erro ao carregar imagem no modal via arquivo, tentando API:', e.currentTarget.src);
                            if (e.currentTarget.src.includes(`/uploads/`)) {
                              e.currentTarget.src = `/api/activity-image/${request.activityId}`;
                            } else {
                              console.log('Todas as tentativas falharam, usando ícone.');
                              e.currentTarget.onerror = null; // Previne loop infinito
                              e.currentTarget.src = "/no-image.svg";
                            }
                          }}
                        />
                        <div className="absolute bottom-0 right-0 p-1 bg-black bg-opacity-50 text-white text-xs rounded-tl">
                          Arquivo
                        </div>
                      </div>
                    )}
                  </div>
                  <div>
                    <CardTitle>Informações da Solicitação</CardTitle>
                    <CardDescription>
                      Criado em {request.createdAt ? new Date(request.createdAt).toLocaleString() : 'data não disponível'}
                    </CardDescription>
                  </div>
                </div>
                <div className="flex flex-col gap-1 items-end">
                  {getPriorityBadge(request.priority)}
                  {getStatusBadge(request.status)}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground text-xs">Solicitado por</Label>
                    <p className="font-medium">{request.requestedBy}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">Quantidade</Label>
                    <p className="font-medium">{request.quantity} {request.quantity > 1 ? 'peças' : 'peça'}</p>
                  </div>
                </div>
                
                <div>
                  <Label className="text-muted-foreground text-xs">Motivo</Label>
                  <p className="font-medium">{request.reason}</p>
                </div>
                
                {request.details && (
                  <div>
                    <Label className="text-muted-foreground text-xs">Detalhes</Label>
                    <p className="text-sm whitespace-pre-wrap">{request.details}</p>
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground text-xs">Departamento Solicitante</Label>
                    <p className="font-medium capitalize">{request.fromDepartment}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">Departamento Destinatário</Label>
                    <p className="font-medium capitalize">{request.toDepartment}</p>
                  </div>
                </div>
                
                {request.status === 'completed' && request.completedBy && (
                  <>
                    <Separator className="my-3" />
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-muted-foreground text-xs">Concluído por</Label>
                        <p className="font-medium">{request.completedBy}</p>
                      </div>
                      {request.completedAt && (
                        <div>
                          <Label className="text-muted-foreground text-xs">Data de Conclusão</Label>
                          <p className="font-medium">{request.completedAt ? new Date(request.completedAt).toLocaleString() : 'data não disponível'}</p>
                        </div>
                      )}
                    </div>
                  </>
                )}
                
                {request.status === 'rejected' && request.completedBy && (
                  <>
                    <Separator className="my-3" />
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-muted-foreground text-xs">Rejeitado por</Label>
                        <p className="font-medium">{request.completedBy}</p>
                      </div>
                      {request.completedAt && (
                        <div>
                          <Label className="text-muted-foreground text-xs">Data de Rejeição</Label>
                          <p className="font-medium">{request.completedAt ? new Date(request.completedAt).toLocaleString() : 'data não disponível'}</p>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Seção para processar a solicitação - apenas visível para o departamento destinatário */}
          {canProcess && (request.status === 'pending' || request.status === 'pendente') && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle>Processar Solicitação</CardTitle>
                <CardDescription>
                  Atualize o status desta solicitação de reimpressão
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="processedBy">Processado por</Label>
                  <Input
                    id="processedBy"
                    value={processedBy}
                    onChange={(e) => setProcessedBy(e.target.value)}
                    placeholder="Nome de quem está processando"
                    disabled={isProcessing}
                  />
                </div>
                
                <div>
                  <Label htmlFor="status">Atualizar Status</Label>
                  <Select 
                    onValueChange={setSelectedStatus}
                    disabled={isProcessing}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o novo status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="in_progress">Em Processamento</SelectItem>
                      <SelectItem value="completed">Concluída</SelectItem>
                      <SelectItem value="rejected">Rejeitada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="responseNotes">Observações</Label>
                  <Textarea
                    id="responseNotes"
                    value={responseNotes}
                    onChange={(e) => setResponseNotes(e.target.value)}
                    placeholder="Observações sobre o processamento (opcional)"
                    disabled={isProcessing}
                  />
                </div>
                
                <div className="flex justify-end space-x-2">
                  <Button
                    variant="outline"
                    onClick={() => handleUpdateStatus(selectedStatus)}
                    disabled={!selectedStatus || isProcessing}
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processando...
                      </>
                    ) : (
                      "Atualizar Status"
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter className="flex justify-between">
          <div>
            {/* Botão de cancelamento - apenas visível para solicitações pendentes */}
            {(request.status === 'pending' || request.status === 'pendente') && (
              <Button 
                onClick={handleCancelRequest}
                variant="destructive"
                disabled={isProcessing}
                className="mr-2"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Cancelando...
                  </>
                ) : (
                  "Cancelar Solicitação"
                )}
              </Button>
            )}
          </div>
          <Button onClick={onClose} variant="outline">
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}