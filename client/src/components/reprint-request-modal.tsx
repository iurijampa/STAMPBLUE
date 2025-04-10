import { useState } from "react";
import { Activity } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

const priorityLabels = {
  low: "Baixa",
  normal: "Normal",
  high: "Alta",
  urgent: "Urgente"
};

interface ReprintRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  activity: Activity | null;
  onSuccess: () => void;
}

export default function ReprintRequestModal({ isOpen, onClose, activity, onSuccess }: ReprintRequestModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [requestedBy, setRequestedBy] = useState("");
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [priority, setPriority] = useState<"low" | "normal" | "high" | "urgent">("normal");
  
  // Mutation para criar solicitação de reimpressão
  const createReprintRequestMutation = useMutation({
    mutationFn: async (data: {
      activityId: number;
      requestedBy: string;
      reason: string;
      details?: string;
      quantity: number;
      priority: "low" | "normal" | "high" | "urgent";
      fromDepartment: string;
      toDepartment: string;
    }) => {
      const response = await apiRequest("POST", "/api/reprint-requests", data);
      return response.json();
    },
    onSuccess: () => {
      // Invalidar cache relevante
      queryClient.invalidateQueries({ queryKey: ["/api/reprint-requests/from-department"] });
      
      // Notificar usuário
      toast({
        title: "Solicitação enviada com sucesso",
        description: "A solicitação de reimpressão foi enviada para o setor de impressão.",
      });
      
      // Limpar formulário
      resetForm();
      
      // Fechar modal e chamar callback de sucesso
      onClose();
      onSuccess();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao enviar solicitação",
        description: error.message || "Ocorreu um erro ao enviar a solicitação de reimpressão. Tente novamente.",
        variant: "destructive",
      });
    }
  });
  
  const resetForm = () => {
    setRequestedBy("");
    setReason("");
    setDetails("");
    setQuantity("1");
    setPriority("normal");
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validação básica
    if (!requestedBy.trim()) {
      toast({
        title: "Campo obrigatório",
        description: "Informe quem está solicitando a reimpressão.",
        variant: "destructive",
      });
      return;
    }
    
    if (!reason.trim()) {
      toast({
        title: "Campo obrigatório",
        description: "Informe o motivo da reimpressão.",
        variant: "destructive",
      });
      return;
    }
    
    if (!activity) {
      toast({
        title: "Erro",
        description: "Nenhuma atividade selecionada para reimpressão.",
        variant: "destructive",
      });
      return;
    }
    
    // Enviar solicitação
    createReprintRequestMutation.mutate({
      activityId: activity.id,
      requestedBy,
      reason,
      details: details || undefined,
      quantity: parseInt(quantity, 10),
      priority,
      fromDepartment: "batida",
      toDepartment: "impressao",
    });
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Solicitar Reimpressão</DialogTitle>
          <DialogDescription>
            {activity ? `Pedido: ${activity.title}` : 'Carregando...'}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="requestedBy">Solicitado por *</Label>
            <Input
              id="requestedBy"
              placeholder="Seu nome"
              value={requestedBy}
              onChange={(e) => setRequestedBy(e.target.value)}
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="reason">Motivo da reimpressão *</Label>
            <Input
              id="reason"
              placeholder="Motivo (ex: defeito na impressão)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="details">Detalhes (opcional)</Label>
            <Textarea
              id="details"
              placeholder="Descreva detalhes adicionais se necessário"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={3}
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantidade</Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label>Prioridade</Label>
              <RadioGroup value={priority} onValueChange={(value) => setPriority(value as any)}>
                <div className="flex gap-4 flex-wrap">
                  {Object.entries(priorityLabels).map(([value, label]) => (
                    <div key={value} className="flex items-center space-x-2">
                      <RadioGroupItem value={value} id={`priority-${value}`} />
                      <Label htmlFor={`priority-${value}`} className="cursor-pointer">
                        {label}
                      </Label>
                    </div>
                  ))}
                </div>
              </RadioGroup>
            </div>
          </div>
          
          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={createReprintRequestMutation.isPending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createReprintRequestMutation.isPending}>
              {createReprintRequestMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                'Solicitar Reimpressão'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}