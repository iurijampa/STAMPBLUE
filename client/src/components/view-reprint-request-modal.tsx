import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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

interface ViewReprintRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: ReprintRequest | null;
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

export default function ViewReprintRequestModal({
  isOpen,
  onClose,
  request
}: ViewReprintRequestModalProps) {
  // Função para formatar a data
  const formatDate = (dateString?: string) => {
    if (!dateString) return "Não informado";
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!request) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Solicitação de Reimpressão
            <Badge className={statusColors[request.status]}>
              {statusLabels[request.status]}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            {request.activityTitle || `Atividade #${request.activityId}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-medium">Prioridade</h4>
              <p className="text-sm">
                <Badge className={priorityColors[request.priority]}>
                  {priorityLabels[request.priority]}
                </Badge>
              </p>
            </div>
            <div>
              <h4 className="text-sm font-medium">Quantidade</h4>
              <p className="text-sm">{request.quantity}</p>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium">Solicitado por</h4>
            <p className="text-sm">{request.requestedBy}</p>
          </div>

          <div>
            <h4 className="text-sm font-medium">Data da solicitação</h4>
            <p className="text-sm">{formatDate(request.requestedAt)}</p>
          </div>

          <div>
            <h4 className="text-sm font-medium">Motivo</h4>
            <p className="text-sm">{request.reason}</p>
          </div>

          {request.details && (
            <div>
              <h4 className="text-sm font-medium">Detalhes</h4>
              <p className="text-sm whitespace-pre-line">{request.details}</p>
            </div>
          )}

          {request.status === 'completed' && (
            <>
              <div>
                <h4 className="text-sm font-medium">Concluído por</h4>
                <p className="text-sm">{request.completedBy || "Não informado"}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium">Data de conclusão</h4>
                <p className="text-sm">{formatDate(request.completedAt)}</p>
              </div>
            </>
          )}

          {request.status === 'rejected' && (
            <>
              <div>
                <h4 className="text-sm font-medium">Rejeitado por</h4>
                <p className="text-sm">{request.completedBy || "Não informado"}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium">Data de rejeição</h4>
                <p className="text-sm">{formatDate(request.completedAt)}</p>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="mt-6">
          <Button onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}