import { Activity } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import { ImageIcon, Loader2 } from "lucide-react";

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
  requestedAt: string;
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
                  <div className="flex-shrink-0 w-16 h-16 rounded-md overflow-hidden border bg-slate-50 flex items-center justify-center">
                    {request.activityImage ? (
                      <img 
                        src={request.activityImage}
                        alt={request.activityTitle || `Pedido ${request.activityId}`} 
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          console.log('Erro ao carregar imagem:', request.activityImage);
                          e.currentTarget.src = "/no-image.svg";
                        }}
                      />
                    ) : (
                      <ImageIcon className="w-8 h-8 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <CardTitle>Informações da Solicitação</CardTitle>
                    <CardDescription>
                      Criado em {new Date(request.requestedAt).toLocaleString()}
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
                  <Separator />
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground text-xs">Concluído por</Label>
                      <p className="font-medium">{request.completedBy}</p>
                    </div>
                    {request.completedAt && (
                      <div>
                        <Label className="text-muted-foreground text-xs">Data de Conclusão</Label>
                        <p className="font-medium">{new Date(request.completedAt).toLocaleString()}</p>
                      </div>
                    )}
                  </div>
                </>
              )}
              
              {request.status === 'rejected' && request.completedBy && (
                <>
                  <Separator />
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground text-xs">Rejeitado por</Label>
                      <p className="font-medium">{request.completedBy}</p>
                    </div>
                    {request.completedAt && (
                      <div>
                        <Label className="text-muted-foreground text-xs">Data de Rejeição</Label>
                        <p className="font-medium">{new Date(request.completedAt).toLocaleString()}</p>
                      </div>
                    )}
                  </div>
                </>
              )}
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

        <DialogFooter>
          <Button onClick={onClose} variant="outline">
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}