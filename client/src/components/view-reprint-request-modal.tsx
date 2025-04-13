import { Activity } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import { AlertTriangle, Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Adicionado status "cancelada" ao tipo de status da solicitação
type RequestStatus = 
  | "pending" | "in_progress" | "completed" | "rejected" 
  | "pendente" | "em_andamento" | "concluida" | "rejeitada" 
  | "cancelada";

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
  status: RequestStatus; // Usando o tipo RequestStatus que inclui "cancelada"
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
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [processedBy, setProcessedBy] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [responseNotes, setResponseNotes] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  // Determina se o usuário atual pode processar a solicitação (apenas o departamento de destino)
  const canProcess = user?.department === request.toDepartment && 
                    (request.status === 'pending' || request.status === 'pendente');

  // Mutation para atualizar o status de uma solicitação
  const updateStatusMutation = useMutation({
    mutationFn: async ({ 
      requestId, 
      newStatus, 
      completedBy, 
      notes 
    }: { 
      requestId: number, 
      newStatus: string, 
      completedBy: string, 
      notes?: string 
    }) => {
      const res = await apiRequest("POST", `/api/reimpressao-emergencial/atualizar-status`, {
        requestId,
        newStatus,
        completedBy,
        notes
      });
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Status atualizado",
        description: "O status da solicitação foi atualizado com sucesso!",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/reimpressao-emergencial/listar'] });
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar status",
        description: error.message || "Ocorreu um erro ao atualizar o status da solicitação.",
        variant: "destructive",
      });
    },
  });

  // Mutation para cancelar uma solicitação
  const cancelRequestMutation = useMutation({
    mutationFn: async ({ 
      requestId, 
      canceledBy 
    }: { 
      requestId: number, 
      canceledBy: string 
    }) => {
      const res = await apiRequest("POST", `/api/reimpressao-emergencial/cancelar`, {
        requestId,
        canceledBy
      });
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Solicitação cancelada",
        description: "A solicitação de reimpressão foi cancelada com sucesso!",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/reimpressao-emergencial/listar'] });
      setShowCancelConfirm(false);
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao cancelar solicitação",
        description: error.message || "Ocorreu um erro ao cancelar a solicitação de reimpressão.",
        variant: "destructive",
      });
      setShowCancelConfirm(false);
    },
  });

  // Função para executar o cancelamento da solicitação
  const executeCancelRequest = () => {
    if (!processedBy.trim()) {
      toast({
        title: "Nome obrigatório",
        description: "Por favor, informe seu nome para cancelar a solicitação.",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    cancelRequestMutation.mutate({ 
      requestId: request.id, 
      canceledBy: processedBy 
    });
  };

  // Função para abrir o diálogo de confirmação de cancelamento
  const handleCancelRequest = () => {
    setShowCancelConfirm(true);
  };

  // Função para atualizar o status da solicitação
  const handleUpdateStatus = (newStatus: string) => {
    if (!newStatus) {
      toast({
        title: "Status obrigatório",
        description: "Por favor, selecione um novo status para a solicitação.",
        variant: "destructive",
      });
      return;
    }

    if (!processedBy.trim()) {
      toast({
        title: "Nome obrigatório",
        description: "Por favor, informe seu nome para processar a solicitação.",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    updateStatusMutation.mutate({
      requestId: request.id,
      newStatus,
      completedBy: processedBy,
      notes: responseNotes.trim() || undefined
    });
  };

  // Função para renderizar badge de prioridade
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
        return <Badge variant="outline">Normal</Badge>;
    }
  };

  // Função para renderizar badge de status
  const getStatusBadge = (status: RequestStatus) => {
    switch (status) {
      case 'pending':
      case 'pendente':
        return <Badge variant="outline">Pendente</Badge>;
      case 'in_progress':
      case 'em_andamento':
        return <Badge variant="secondary">Em Andamento</Badge>;
      case 'completed':
      case 'concluida':
        return <Badge variant="default" className="bg-green-500">Concluída</Badge>;
      case 'rejected':
      case 'rejeitada':
        return <Badge variant="destructive">Rejeitada</Badge>;
      case 'cancelada':
        return <Badge variant="destructive" className="bg-gray-500">Cancelada</Badge>;
      default:
        return <Badge variant="outline">Desconhecido</Badge>;
    }
  };

  return (
    <>
      {/* Modal de confirmação de cancelamento */}
      <AlertDialog open={showCancelConfirm} onOpenChange={setShowCancelConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Cancelar Solicitação
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja cancelar esta solicitação de reimpressão? 
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="py-4">
            <Label htmlFor="canceledBy" className="text-muted-foreground mb-2 block">
              Informe seu nome para confirmar
            </Label>
            <Input
              id="canceledBy"
              value={processedBy}
              onChange={(e) => setProcessedBy(e.target.value)}
              placeholder="Seu nome completo"
              className="mb-2"
              disabled={isProcessing}
              autoFocus
            />
            
            <p className="text-sm text-muted-foreground">
              Este nome será registrado no histórico de cancelamento.
            </p>
          </div>
          
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={(e) => {
                e.preventDefault();
                executeCancelRequest();
              }}
              disabled={isProcessing || !processedBy.trim()}
              className="bg-red-500 hover:bg-red-600"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processando...
                </>
              ) : (
                "Confirmar Cancelamento"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      <Dialog 
        open={isOpen} 
        onOpenChange={(open) => {
          if (!open) {
            setShowCancelConfirm(false); // Fechar o modal de confirmação também
            onClose();
          }
        }}
      >
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
              {/* Botão de cancelamento - apenas visível para solicitações pendentes ou em andamento */}
              {(request.status === 'pending' || request.status === 'pendente' || 
                request.status === 'in_progress' || request.status === 'em_andamento') && (
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
    </>
  );
}
