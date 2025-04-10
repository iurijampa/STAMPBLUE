import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { 
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Loader2, CheckCircle2, XCircle, AlertTriangle, ArrowRight } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Activity } from "@shared/schema";

interface ReprintRequest {
  id: number;
  activityId: number;
  quantity: number;
  reason: string;
  details?: string;
  requestedBy: string;
  requestedDepartment: string;
  targetDepartment: string;
  priority: string;
  status: string;
  completedBy?: string;
  requestedAt: string;
  completedAt?: string;
  receivedBy?: string;
  receivedAt?: string;
  activity?: Activity;
}

interface ReprintRequestsListProps {
  department: string;
}

export default function ReprintRequestsList({ department }: ReprintRequestsListProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedRequest, setSelectedRequest] = useState<ReprintRequest | null>(null);
  const [completeModalOpen, setCompleteModalOpen] = useState(false);
  const [receiveModalOpen, setReceiveModalOpen] = useState(false);
  const [completedBy, setCompletedBy] = useState("");
  const [receivedBy, setReceivedBy] = useState("");

  // Determinar URL com base no departamento
  const queryUrl = department === "impressao" 
    ? "/api/reprint-requests/department/impressao/pending"
    : "/api/reprint-requests/department/batida";

  // Buscar solicitações de reimpressão
  const { data: reprintRequests = [], isLoading } = useQuery({
    queryKey: [queryUrl],
    queryFn: async () => {
      const response = await fetch(queryUrl, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`Erro ao buscar reimpressões: ${response.statusText}`);
      }
      
      return await response.json() as ReprintRequest[];
    }
  });

  // Mutação para concluir uma solicitação (setor de impressão)
  const completeRequestMutation = useMutation({
    mutationFn: async (data: { id: number, completedBy: string }) => {
      const response = await apiRequest("POST", `/api/reprint-requests/${data.id}/complete`, { completedBy: data.completedBy });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Reimpressão concluída",
        description: "A reimpressão foi marcada como concluída com sucesso."
      });
      
      // Invalidar cache para atualizar dados
      queryClient.invalidateQueries({ queryKey: [queryUrl] });
      
      // Fechar modal
      setCompleteModalOpen(false);
      setSelectedRequest(null);
      setCompletedBy("");
    },
    onError: (error) => {
      toast({
        title: "Erro ao concluir reimpressão",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Mutação para confirmar recebimento (setor de batida)
  const confirmReceiptMutation = useMutation({
    mutationFn: async (data: { id: number, receivedBy: string }) => {
      const response = await apiRequest("POST", `/api/reprint-requests/${data.id}/receive`, { receivedBy: data.receivedBy });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Recebimento confirmado",
        description: "O recebimento da reimpressão foi confirmado com sucesso."
      });
      
      // Invalidar cache para atualizar dados
      queryClient.invalidateQueries({ queryKey: [queryUrl] });
      
      // Fechar modal
      setReceiveModalOpen(false);
      setSelectedRequest(null);
      setReceivedBy("");
    },
    onError: (error) => {
      toast({
        title: "Erro ao confirmar recebimento",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Função para formatar data
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Funções para abrir modais
  const handleCompleteRequest = (request: ReprintRequest) => {
    setSelectedRequest(request);
    setCompleteModalOpen(true);
  };

  const handleConfirmReceipt = (request: ReprintRequest) => {
    setSelectedRequest(request);
    setReceiveModalOpen(true);
  };

  // Renderizar badge de status
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200">Pendente</Badge>;
      case 'completed':
        return <Badge variant="outline" className="bg-green-100 text-green-800 hover:bg-green-200">Concluído</Badge>;
      case 'cancelled':
        return <Badge variant="outline" className="bg-red-100 text-red-800 hover:bg-red-200">Cancelado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Renderizar badge de prioridade
  const renderPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return <Badge variant="outline" className="bg-red-100 text-red-800 hover:bg-red-200">Urgente</Badge>;
      case 'normal':
      default:
        return <Badge variant="outline" className="bg-blue-100 text-blue-800 hover:bg-blue-200">Normal</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (reprintRequests.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        {department === "impressao" 
          ? "Não há solicitações de reimpressão pendentes." 
          : "Você ainda não tem solicitações de reimpressão."
        }
      </div>
    );
  }

  return (
    <div>
      <Table>
        <TableCaption>
          {department === "impressao" 
            ? "Lista de reimpressões solicitadas pelo setor de batida" 
            : "Suas solicitações de reimpressão"
          }
        </TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Pedido</TableHead>
            <TableHead>Quantidade</TableHead>
            <TableHead>Motivo</TableHead>
            <TableHead>Prioridade</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Solicitado em</TableHead>
            <TableHead>Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {reprintRequests.map((request) => (
            <TableRow key={request.id}>
              <TableCell className="font-medium">
                {request.activity?.title || `Pedido #${request.activityId}`}
              </TableCell>
              <TableCell>{request.quantity}</TableCell>
              <TableCell>
                <span className="max-w-[150px] truncate block" title={request.reason}>
                  {request.reason}
                </span>
              </TableCell>
              <TableCell>{renderPriorityBadge(request.priority)}</TableCell>
              <TableCell>{renderStatusBadge(request.status)}</TableCell>
              <TableCell>{formatDate(request.requestedAt)}</TableCell>
              <TableCell>
                {department === "impressao" && request.status === "pending" && (
                  <Button 
                    size="sm" 
                    onClick={() => handleCompleteRequest(request)}
                    className="flex items-center"
                  >
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                    Concluir
                  </Button>
                )}
                
                {department === "batida" && request.status === "completed" && !request.receivedBy && (
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => handleConfirmReceipt(request)}
                    className="flex items-center"
                  >
                    <ArrowRight className="h-4 w-4 mr-1" />
                    Confirmar Recebimento
                  </Button>
                )}
                
                {request.status === "completed" && request.receivedBy && (
                  <span className="text-sm text-muted-foreground flex items-center">
                    <CheckCircle2 className="h-4 w-4 mr-1 text-green-600" />
                    Recebido por: {request.receivedBy}
                  </span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Modal para concluir reimpressão */}
      <Dialog open={completeModalOpen} onOpenChange={setCompleteModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Concluir Reimpressão</DialogTitle>
          </DialogHeader>
          
          <div className="py-4">
            <div className="space-y-4">
              <div>
                <Label htmlFor="completedBy" className="required">Concluído por</Label>
                <Input
                  id="completedBy"
                  placeholder="Seu nome"
                  value={completedBy}
                  onChange={(e) => setCompletedBy(e.target.value)}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Informe seu nome para registrar quem concluiu a reimpressão.
                </p>
              </div>
              
              {selectedRequest && (
                <div className="bg-muted/30 p-3 rounded-md mt-4">
                  <h4 className="font-medium mb-1">Detalhes da solicitação:</h4>
                  <p className="text-sm"><strong>Pedido:</strong> {selectedRequest.activity?.title || `#${selectedRequest.activityId}`}</p>
                  <p className="text-sm"><strong>Quantidade:</strong> {selectedRequest.quantity}</p>
                  <p className="text-sm"><strong>Motivo:</strong> {selectedRequest.reason}</p>
                  {selectedRequest.details && (
                    <p className="text-sm"><strong>Detalhes:</strong> {selectedRequest.details}</p>
                  )}
                  <p className="text-sm"><strong>Solicitado por:</strong> {selectedRequest.requestedBy}</p>
                </div>
              )}
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompleteModalOpen(false)}>
              Cancelar
            </Button>
            <Button 
              disabled={!completedBy.trim() || completeRequestMutation.isPending}
              onClick={() => {
                if (selectedRequest && completedBy.trim()) {
                  completeRequestMutation.mutate({
                    id: selectedRequest.id,
                    completedBy: completedBy.trim()
                  });
                }
              }}
            >
              {completeRequestMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Concluindo...
                </>
              ) : "Confirmar Conclusão"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Modal para confirmar recebimento */}
      <Dialog open={receiveModalOpen} onOpenChange={setReceiveModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Confirmar Recebimento</DialogTitle>
          </DialogHeader>
          
          <div className="py-4">
            <div className="space-y-4">
              <div>
                <Label htmlFor="receivedBy" className="required">Recebido por</Label>
                <Input
                  id="receivedBy"
                  placeholder="Seu nome"
                  value={receivedBy}
                  onChange={(e) => setReceivedBy(e.target.value)}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Informe seu nome para registrar quem recebeu a reimpressão.
                </p>
              </div>
              
              {selectedRequest && (
                <div className="bg-muted/30 p-3 rounded-md mt-4">
                  <h4 className="font-medium mb-1">Detalhes da reimpressão:</h4>
                  <p className="text-sm"><strong>Pedido:</strong> {selectedRequest.activity?.title || `#${selectedRequest.activityId}`}</p>
                  <p className="text-sm"><strong>Quantidade:</strong> {selectedRequest.quantity}</p>
                  <p className="text-sm"><strong>Concluído por:</strong> {selectedRequest.completedBy}</p>
                  <p className="text-sm"><strong>Concluído em:</strong> {selectedRequest.completedAt ? formatDate(selectedRequest.completedAt) : 'N/A'}</p>
                </div>
              )}
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setReceiveModalOpen(false)}>
              Cancelar
            </Button>
            <Button 
              disabled={!receivedBy.trim() || confirmReceiptMutation.isPending}
              onClick={() => {
                if (selectedRequest && receivedBy.trim()) {
                  confirmReceiptMutation.mutate({
                    id: selectedRequest.id,
                    receivedBy: receivedBy.trim()
                  });
                }
              }}
            >
              {confirmReceiptMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Confirmando...
                </>
              ) : "Confirmar Recebimento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}