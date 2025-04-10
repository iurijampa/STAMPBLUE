import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, AlertTriangle, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
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
  const [isCompletingRequest, setIsCompletingRequest] = useState(false);
  const [isConfirmingReceipt, setIsConfirmingReceipt] = useState(false);
  const [completedBy, setCompletedBy] = useState("");
  const [receivedBy, setReceivedBy] = useState("");
  
  // Buscar solicitações de reimpressão para este departamento
  const { data: requests, isLoading, error } = useQuery<ReprintRequest[]>({
    queryKey: [`/api/department/${department}/reprint-requests`],
    staleTime: 5000,
  });
  
  // Filtrar solicitações pendentes e completadas
  const pendingRequests = requests?.filter(req => req.status === "pending") || [];
  const completedRequests = requests?.filter(req => req.status === "completed") || [];
  
  // Mutação para completar uma solicitação (setor de impressão)
  const completeRequestMutation = useMutation({
    mutationFn: async ({ id, completedBy }: { id: number; completedBy: string }) => {
      const res = await apiRequest("POST", `/api/reprint-requests/${id}/complete`, { completedBy });
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Reimpressão concluída",
        description: "A solicitação de reimpressão foi marcada como concluída.",
      });
      
      // Invalidar queries para atualizar os dados
      queryClient.invalidateQueries({ queryKey: [`/api/department/${department}/reprint-requests`] });
      
      // Resetar estado
      setSelectedRequest(null);
      setCompletedBy("");
      setIsCompletingRequest(false);
    },
    onError: (error) => {
      toast({
        title: "Erro ao concluir reimpressão",
        description: error.message || "Ocorreu um erro ao completar a solicitação.",
        variant: "destructive",
      });
    },
  });
  
  // Mutação para confirmar recebimento (setor de batida)
  const confirmReceiptMutation = useMutation({
    mutationFn: async ({ id, receivedBy }: { id: number; receivedBy: string }) => {
      const res = await apiRequest("POST", `/api/reprint-requests/${id}/confirm-received`, { receivedBy });
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Recebimento confirmado",
        description: "O recebimento da reimpressão foi confirmado com sucesso.",
      });
      
      // Invalidar queries para atualizar os dados
      queryClient.invalidateQueries({ queryKey: [`/api/department/${department}/reprint-requests`] });
      
      // Resetar estado
      setSelectedRequest(null);
      setReceivedBy("");
      setIsConfirmingReceipt(false);
    },
    onError: (error) => {
      toast({
        title: "Erro ao confirmar recebimento",
        description: error.message || "Ocorreu um erro ao confirmar o recebimento.",
        variant: "destructive",
      });
    },
  });
  
  // Handle para completar uma solicitação
  const handleCompleteRequest = (request: ReprintRequest) => {
    setSelectedRequest(request);
    setIsCompletingRequest(true);
  };
  
  // Handle para confirmar recebimento
  const handleConfirmReceipt = (request: ReprintRequest) => {
    setSelectedRequest(request);
    setIsConfirmingReceipt(true);
  };
  
  // Submit para completar solicitação
  const submitCompleteRequest = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedRequest) return;
    
    if (!completedBy.trim()) {
      toast({
        title: "Campo obrigatório",
        description: "Por favor, informe quem está completando a reimpressão.",
        variant: "destructive",
      });
      return;
    }
    
    completeRequestMutation.mutate({
      id: selectedRequest.id,
      completedBy,
    });
  };
  
  // Submit para confirmar recebimento
  const submitConfirmReceipt = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedRequest) return;
    
    if (!receivedBy.trim()) {
      toast({
        title: "Campo obrigatório",
        description: "Por favor, informe quem está recebendo a reimpressão.",
        variant: "destructive",
      });
      return;
    }
    
    confirmReceiptMutation.mutate({
      id: selectedRequest.id,
      receivedBy,
    });
  };
  
  if (isLoading) {
    return (
      <div className="py-4 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="py-4 text-center text-red-500">
        <AlertTriangle className="h-6 w-6 mx-auto mb-2" />
        <p>Erro ao carregar solicitações de reimpressão.</p>
      </div>
    );
  }
  
  // Determinar o que mostrar com base no departamento
  const showPendingRequests = department === "impressao" ? pendingRequests : [];
  const showCompletedRequests = department === "batida" 
    ? completedRequests.filter(req => !req.receivedBy) 
    : department === "impressao" 
      ? completedRequests 
      : [];
  
  if (showPendingRequests.length === 0 && showCompletedRequests.length === 0) {
    return (
      <div className="py-4 text-center text-gray-500">
        <p>Não há solicitações de reimpressão {department === "impressao" ? "pendentes" : "para receber"}.</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      {/* Setor de Impressão - Solicitações Pendentes */}
      {department === "impressao" && showPendingRequests.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Solicitações Pendentes</h3>
          
          <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2">
            {showPendingRequests.map(request => (
              <Card key={request.id} className={request.priority === "urgent" ? "border-red-400" : ""}>
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-base">{request.activity?.title}</CardTitle>
                    <Badge variant={request.priority === "urgent" ? "destructive" : "outline"}>
                      {request.priority === "urgent" ? "URGENTE" : "Normal"}
                    </Badge>
                  </div>
                  <CardDescription>
                    Quantidade: {request.quantity} peças
                  </CardDescription>
                </CardHeader>
                
                <CardContent className="pb-2 text-sm">
                  <p className="font-semibold mb-1">Motivo:</p>
                  <p>{request.reason}</p>
                  
                  {request.details && (
                    <>
                      <p className="font-semibold mt-2 mb-1">Detalhes:</p>
                      <p>{request.details}</p>
                    </>
                  )}
                  
                  <div className="mt-2 text-sm text-muted-foreground">
                    <p>Solicitado por: <span className="font-medium">{request.requestedBy}</span></p>
                    <p>
                      <Clock className="inline h-3 w-3 mr-1" />
                      {formatDistanceToNow(new Date(request.requestedAt), { 
                        addSuffix: true, locale: ptBR 
                      })}
                    </p>
                  </div>
                </CardContent>
                
                <CardFooter>
                  <Button 
                    onClick={() => handleCompleteRequest(request)}
                    className="w-full"
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Concluir Reimpressão
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      )}
      
      {/* Setor de Batida - Reimpressões para Receber */}
      {department === "batida" && showCompletedRequests.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Reimpressões para Receber</h3>
          
          <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2">
            {showCompletedRequests.map(request => (
              <Card key={request.id} className={request.priority === "urgent" ? "border-red-400" : ""}>
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-base">{request.activity?.title}</CardTitle>
                    <Badge variant={request.priority === "urgent" ? "destructive" : "outline"}>
                      {request.priority === "urgent" ? "URGENTE" : "Normal"}
                    </Badge>
                  </div>
                  <CardDescription>
                    Quantidade: {request.quantity} peças
                  </CardDescription>
                </CardHeader>
                
                <CardContent className="pb-2 text-sm">
                  <p className="font-semibold mb-1">Motivo da solicitação:</p>
                  <p>{request.reason}</p>
                  
                  <div className="mt-2 text-sm">
                    <p>Solicitado por: <span className="font-medium">{request.requestedBy}</span></p>
                    <p>Concluído por: <span className="font-medium">{request.completedBy}</span></p>
                    <p className="text-muted-foreground">
                      <Clock className="inline h-3 w-3 mr-1" />
                      Concluído {formatDistanceToNow(new Date(request.completedAt!), { 
                        addSuffix: true, locale: ptBR 
                      })}
                    </p>
                  </div>
                </CardContent>
                
                <CardFooter>
                  <Button 
                    onClick={() => handleConfirmReceipt(request)}
                    className="w-full"
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Confirmar Recebimento
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      )}
      
      {/* Setor de Impressão - Solicitações Completadas (histórico) */}
      {department === "impressao" && completedRequests.length > 0 && (
        <div className="space-y-4 mt-8">
          <h3 className="text-lg font-semibold">Histórico de Reimpressões</h3>
          
          <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2">
            {completedRequests.map(request => (
              <Card key={request.id} className="opacity-75">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{request.activity?.title}</CardTitle>
                  <CardDescription>
                    Quantidade: {request.quantity} peças
                  </CardDescription>
                </CardHeader>
                
                <CardContent className="pb-2 text-sm">
                  <p>{request.reason}</p>
                  
                  <div className="mt-2 text-sm text-muted-foreground">
                    <p>Solicitado por: {request.requestedBy}</p>
                    <p>Concluído por: {request.completedBy}</p>
                    <p>
                      <Clock className="inline h-3 w-3 mr-1" />
                      {formatDistanceToNow(new Date(request.completedAt!), { 
                        addSuffix: true, locale: ptBR 
                      })}
                    </p>
                    {request.receivedBy && (
                      <p>Recebido por: {request.receivedBy}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
      
      {/* Modal para completar solicitação (impressão) */}
      <Dialog open={isCompletingRequest} onOpenChange={() => setIsCompletingRequest(false)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Concluir Reimpressão</DialogTitle>
          </DialogHeader>
          
          <form onSubmit={submitCompleteRequest} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="completed-by" className="required">Concluído por</Label>
              <Input 
                id="completed-by"
                placeholder="Nome de quem fez a reimpressão"
                value={completedBy}
                onChange={(e) => setCompletedBy(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                Informe o nome de quem realizou a reimpressão.
              </p>
            </div>
            
            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsCompletingRequest(false)}
              >
                Cancelar
              </Button>
              <Button 
                type="submit"
                disabled={completeRequestMutation.isPending}
              >
                {completeRequestMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : "Concluir Reimpressão"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      
      {/* Modal para confirmar recebimento (batida) */}
      <Dialog open={isConfirmingReceipt} onOpenChange={() => setIsConfirmingReceipt(false)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Confirmar Recebimento</DialogTitle>
          </DialogHeader>
          
          <form onSubmit={submitConfirmReceipt} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="received-by" className="required">Recebido por</Label>
              <Input 
                id="received-by"
                placeholder="Nome de quem está recebendo"
                value={receivedBy}
                onChange={(e) => setReceivedBy(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                Informe o nome de quem está recebendo as peças reimpressas.
              </p>
            </div>
            
            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsConfirmingReceipt(false)}
              >
                Cancelar
              </Button>
              <Button 
                type="submit"
                disabled={confirmReceiptMutation.isPending}
              >
                {confirmReceiptMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : "Confirmar Recebimento"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}