import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, RotateCw, Eye } from "lucide-react";
import ViewReprintRequestModal from "./view-reprint-request-modal";

// Interface para representar uma solicitação de reimpressão
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
  fromDepartment: string;
  toDepartment: string;
}

interface ReprintRequestsForDepartmentProps {
  department: string;
}

export default function ReprintRequestsForDepartment({ department }: ReprintRequestsForDepartmentProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<ReprintRequest | null>(null);
  const [activeTab, setActiveTab] = useState("pending");

  // MODO EMERGENCIAL: Buscar solicitações usando a API emergencial
  const { data: requests, isLoading, error, refetch } = useQuery({
    queryKey: ["/api/reimpressao-emergencial/listar"],
    queryFn: async () => {
      try {
        console.log("Buscando solicitações emergenciais para o setor de impressão");
        const response = await fetch(`/api/reimpressao-emergencial/listar`);
        if (!response.ok) {
          throw new Error("Erro ao buscar solicitações de reimpressão");
        }
        
        const allRequests = await response.json() as ReprintRequest[];
        
        // Filtramos apenas as solicitações destinadas a este departamento
        const filteredRequests = allRequests.filter(req => 
          req.toDepartment === department
        );
        
        console.log(`Encontradas ${filteredRequests.length} solicitações emergenciais para o setor ${department}`);
        return filteredRequests;
      } catch (error) {
        console.error("Erro ao buscar solicitações:", error);
        throw error;
      }
    },
    // Atualizar dados a cada 5 segundos
    refetchInterval: 5000,
    // Atualizar mesmo quando a aba está em segundo plano
    refetchIntervalInBackground: true,
    retry: 1,
  });

  // Filtrar solicitações com base na aba ativa
  const filteredRequests = requests?.filter(req => {
    if (activeTab === "pending") {
      return req.status === "pending" || req.status === "in_progress";
    } else if (activeTab === "completed") {
      return req.status === "completed";
    } else if (activeTab === "rejected") {
      return req.status === "rejected";
    }
    return true;
  });

  // Abrir modal para visualizar detalhes de uma solicitação
  const handleViewRequest = (request: ReprintRequest) => {
    setSelectedRequest(request);
    setIsViewModalOpen(true);
  };

  // Lidar com o fechamento do modal
  const handleCloseModal = () => {
    setIsViewModalOpen(false);
    // Recarregar dados após fechar o modal para obter atualizações
    queryClient.invalidateQueries({ queryKey: ["/api/reimpressao-emergencial/listar"] });
  };

  // Formatação condicional com base na prioridade
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

  // Formatação condicional com base no status
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700">Pendente</Badge>;
      case 'in_progress':
        return <Badge variant="secondary" className="bg-blue-50 text-blue-700">Em Processo</Badge>;
      case 'completed':
        return <Badge variant="default" className="bg-green-50 text-green-700">Concluída</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rejeitada</Badge>;
      default:
        return <Badge variant="outline">Desconhecido</Badge>;
    }
  };

  // Contagem de solicitações por status
  const pendingCount = requests?.filter(r => r.status === "pending" || r.status === "in_progress").length || 0;
  const completedCount = requests?.filter(r => r.status === "completed").length || 0;
  const rejectedCount = requests?.filter(r => r.status === "rejected").length || 0;

  // Ordenar as solicitações por prioridade e data
  const sortedRequests = filteredRequests?.slice().sort((a, b) => {
    // Primeiro por prioridade (urgent > high > normal > low)
    const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 };
    const priorityA = priorityOrder[a.priority] || 2;
    const priorityB = priorityOrder[b.priority] || 2;
    
    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }
    
    // Depois por data (mais recente primeiro)
    return new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime();
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-6">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-red-600">
        Erro ao carregar solicitações de reimpressão. 
        <Button onClick={() => refetch()} variant="outline" size="sm" className="ml-2">
          <RotateCw className="h-4 w-4 mr-1" />
          Tentar novamente
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Solicitações de Reimpressão</h2>
      
      <Tabs defaultValue="pending" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="pending">
            Pendentes <Badge variant="outline" className="ml-2">{pendingCount}</Badge>
          </TabsTrigger>
          <TabsTrigger value="completed">
            Concluídas <Badge variant="outline" className="ml-2">{completedCount}</Badge>
          </TabsTrigger>
          <TabsTrigger value="rejected">
            Rejeitadas <Badge variant="outline" className="ml-2">{rejectedCount}</Badge>
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="pending" className="mt-4">
          {sortedRequests && sortedRequests.length > 0 ? (
            <ScrollArea className="h-[400px] rounded-md border">
              <div className="space-y-2 p-2">
                {sortedRequests.map((request) => (
                  <Card key={request.id} className="cursor-pointer hover:bg-muted/40">
                    <CardHeader className="p-3 pb-0">
                      <div className="flex justify-between items-center">
                        <CardTitle className="text-base">
                          {request.activityTitle || `Pedido #${request.activityId}`}
                        </CardTitle>
                        <div className="flex items-center space-x-2">
                          {getPriorityBadge(request.priority)}
                          {getStatusBadge(request.status)}
                        </div>
                      </div>
                      <CardDescription className="text-xs">
                        Solicitado por: {request.requestedBy} em {new Date(request.requestedAt).toLocaleDateString()}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-3 pt-1">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">Motivo: {request.reason}</p>
                        <p className="text-xs text-muted-foreground">
                          Quantidade: {request.quantity} {request.quantity > 1 ? 'peças' : 'peça'}
                        </p>
                      </div>
                    </CardContent>
                    <CardFooter className="p-3 pt-0 flex justify-end">
                      <Button variant="ghost" size="sm" onClick={() => handleViewRequest(request)}>
                        <Eye className="h-4 w-4 mr-1" /> Ver Detalhes
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div className="text-center py-8 border rounded-md bg-muted/20">
              <p className="text-muted-foreground">
                Nenhuma solicitação pendente encontrada.
              </p>
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="completed" className="mt-4">
          {sortedRequests && sortedRequests.length > 0 ? (
            <ScrollArea className="h-[400px] rounded-md border">
              <div className="space-y-2 p-2">
                {sortedRequests.map((request) => (
                  <Card key={request.id} className="cursor-pointer hover:bg-muted/40">
                    <CardHeader className="p-3 pb-0">
                      <div className="flex justify-between items-center">
                        <CardTitle className="text-base">
                          {request.activityTitle || `Pedido #${request.activityId}`}
                        </CardTitle>
                        <div className="flex space-x-2">
                          {getPriorityBadge(request.priority)}
                          {getStatusBadge(request.status)}
                        </div>
                      </div>
                      <CardDescription className="text-xs">
                        Concluído por: {request.completedBy} em {request.completedAt && new Date(request.completedAt).toLocaleDateString()}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-3 pt-1">
                      <p className="text-sm font-medium">Motivo: {request.reason}</p>
                    </CardContent>
                    <CardFooter className="p-3 pt-0 flex justify-end">
                      <Button variant="ghost" size="sm" onClick={() => handleViewRequest(request)}>
                        <Eye className="h-4 w-4 mr-1" /> Ver Detalhes
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div className="text-center py-8 border rounded-md bg-muted/20">
              <p className="text-muted-foreground">
                Nenhuma solicitação concluída encontrada.
              </p>
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="rejected" className="mt-4">
          {sortedRequests && sortedRequests.length > 0 ? (
            <ScrollArea className="h-[400px] rounded-md border">
              <div className="space-y-2 p-2">
                {sortedRequests.map((request) => (
                  <Card key={request.id} className="cursor-pointer hover:bg-muted/40">
                    <CardHeader className="p-3 pb-0">
                      <div className="flex justify-between items-center">
                        <CardTitle className="text-base">
                          {request.activityTitle || `Pedido #${request.activityId}`}
                        </CardTitle>
                        <div className="flex space-x-2">
                          {getPriorityBadge(request.priority)}
                          {getStatusBadge(request.status)}
                        </div>
                      </div>
                      <CardDescription className="text-xs">
                        Rejeitado por: {request.completedBy} em {request.completedAt && new Date(request.completedAt).toLocaleDateString()}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-3 pt-1">
                      <p className="text-sm font-medium">Motivo: {request.reason}</p>
                    </CardContent>
                    <CardFooter className="p-3 pt-0 flex justify-end">
                      <Button variant="ghost" size="sm" onClick={() => handleViewRequest(request)}>
                        <Eye className="h-4 w-4 mr-1" /> Ver Detalhes
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div className="text-center py-8 border rounded-md bg-muted/20">
              <p className="text-muted-foreground">
                Nenhuma solicitação rejeitada encontrada.
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {isViewModalOpen && selectedRequest && (
        <ViewReprintRequestModal
          isOpen={isViewModalOpen}
          onClose={handleCloseModal}
          request={selectedRequest}
        />
      )}
    </div>
  );
}