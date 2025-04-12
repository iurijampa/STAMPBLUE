import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Activity } from "@shared/schema";
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
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, FilePlus, RotateCw, ImageIcon } from "lucide-react";
import ReprintRequestModal from "./reprint-request-modal";
import ViewReprintRequestModal from "./view-reprint-request-modal";

// Interface para representar uma solicitação de reimpressão
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
  status: "pending" | "in_progress" | "completed" | "rejected";
  requestedAt: string;
  completedBy?: string;
  completedAt?: string;
  receivedBy?: string;
  receivedAt?: string;
  fromDepartment: string;
  toDepartment: string;
}

interface ReprintRequestsListProps {
  department: string;
  activity?: Activity | null;
}

export default function ReprintRequestsList({ department, activity }: ReprintRequestsListProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<ReprintRequest | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);

  // Buscar solicitações usando a API emergencial com atualização periódica
  const { data: requests, isLoading, error } = useQuery({
    queryKey: ["/api/reimpressao-emergencial/listar"],
    queryFn: async () => {
      const response = await fetch(`/api/reimpressao-emergencial/listar`);
      if (!response.ok) {
        throw new Error("Erro ao buscar solicitações de reimpressão");
      }
      return await response.json() as ReprintRequest[];
    },
    // Atualizar dados a cada 5 segundos
    refetchInterval: 5000,
    // Atualizar mesmo quando a aba está em segundo plano
    refetchIntervalInBackground: true
  });

  // Filtrar solicitações para a atividade selecionada, se houver
  const filteredRequests = activity 
    ? requests?.filter(req => req.activityId === activity.id)
    : requests;

  // Abrir modal para criar uma nova solicitação
  const handleCreateRequest = () => {
    setSelectedActivity(activity || null);
    setIsCreateModalOpen(true);
  };

  // Abrir modal para visualizar detalhes de uma solicitação
  const handleViewRequest = (request: ReprintRequest) => {
    setSelectedRequest(request);
    setIsViewModalOpen(true);
  };

  // Lidar com o sucesso na criação de uma solicitação
  const handleRequestSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/reimpressao-emergencial/listar"] });
    toast({
      title: "Solicitação enviada",
      description: "A solicitação de reimpressão foi enviada com sucesso.",
    });
  };

  // Formatação condicional com base na prioridade e status
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
        console.log('Status desconhecido:', status);
        return <Badge variant="outline">Desconhecido</Badge>;
    }
  };

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
        <Button onClick={() => queryClient.invalidateQueries({ 
          queryKey: ["/api/reimpressao-emergencial/listar"] 
        })} variant="outline" size="sm" className="ml-2">
          <RotateCw className="h-4 w-4 mr-1" />
          Tentar novamente
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">
          {activity 
            ? `Solicitações de Reimpressão para ${activity.title}` 
            : "Solicitações de Reimpressão"}
        </h3>
      </div>

      {filteredRequests && filteredRequests.length > 0 ? (
        <ScrollArea className="h-[300px] rounded-md border">
          <div className="space-y-2 p-2">
            {filteredRequests.map((request) => (
              <Card key={request.id} className="cursor-pointer hover:bg-muted/40"
                onClick={() => handleViewRequest(request)}>
                <CardHeader className="p-3 pb-0">
                  <div className="flex justify-between items-start">
                    <div className="flex items-start gap-3">
                      {/* Imagem da atividade como miniatura */}
                      <div className="flex-shrink-0 w-12 h-12 rounded-md overflow-hidden border bg-slate-50 flex items-center justify-center">
                        <img 
                          src={
                            // Caso 1: Caminho direto para a imagem (mostrar diretamente)
                            request.activityId === 53 
                              ? "/uploads/activity_53.jpg" 
                              : request.activityId === 49 
                                ? "/uploads/activity_49.jpg"
                                : request.activityId === 48
                                  ? "/iphone-icon.svg"
                                  // Caso 2: Use a URL da imagem da activity se existir
                                  : request.activityImage?.startsWith("/uploads") || request.activityImage?.startsWith("/iphone-icon.svg")
                                    ? request.activityImage
                                    // Caso 3: Fallback para ícone genérico
                                    : "/no-image.svg"
                          }
                          alt={request.activityTitle || `Pedido ${request.activityId}`}
                          className="w-full h-full object-contain"
                          onError={(e) => {
                            console.log('Erro ao carregar imagem, usando fallback:', e.currentTarget.src);
                            e.currentTarget.src = "/no-image.svg";
                          }}
                        />
                      </div>
                      <div>
                        <CardTitle className="text-base">
                          {request.activityTitle || `Pedido #${request.activityId}`}
                        </CardTitle>
                        <CardDescription className="text-xs">
                          Solicitado por: {request.requestedBy} em {new Date(request.requestedAt).toLocaleDateString()}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      {getPriorityBadge(request.priority)}
                      {getStatusBadge(request.status)}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-3 pt-0">
                  <p className="text-sm truncate">{request.reason}</p>
                </CardContent>
                <CardFooter className="p-3 pt-0 text-xs text-muted-foreground">
                  Quantidade: {request.quantity} {request.quantity > 1 ? 'peças' : 'peça'}
                </CardFooter>
              </Card>
            ))}
          </div>
        </ScrollArea>
      ) : (
        <div className="text-center py-8 border rounded-md bg-muted/20">
          <p className="text-muted-foreground">
            {activity 
              ? "Nenhuma solicitação de reimpressão para este pedido." 
              : "Nenhuma solicitação de reimpressão encontrada."}
          </p>
        </div>
      )}

      {isCreateModalOpen && (
        <ReprintRequestModal 
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          activity={selectedActivity}
          onSuccess={handleRequestSuccess}
        />
      )}

      {isViewModalOpen && selectedRequest && (
        <ViewReprintRequestModal
          isOpen={isViewModalOpen}
          onClose={() => setIsViewModalOpen(false)}
          request={selectedRequest}
        />
      )}
    </div>
  );
}