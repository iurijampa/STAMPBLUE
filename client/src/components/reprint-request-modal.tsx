import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Activity } from "@shared/schema";

// Extensão da interface Activity para aceitar ActivityWithNotes
interface ActivityWithExtras extends Activity {
  previousNotes?: string | null;
  previousDepartment?: string | null;
  previousCompletedBy?: string | null;
  wasReturned?: boolean;
  returnedBy?: string | null;
  returnNotes?: string | null;
  returnedAt?: Date | null;
}

interface ReprintRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  activity: ActivityWithExtras | null;
}

export default function ReprintRequestModal({ isOpen, onClose, activity }: ReprintRequestModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Estados para os campos do formulário
  const [quantity, setQuantity] = useState<number>(1);
  const [reason, setReason] = useState<string>("");
  const [details, setDetails] = useState<string>("");
  const [priority, setPriority] = useState<string>("normal");
  const [requestedBy, setRequestedBy] = useState<string>("");
  
  // Mutação para criar uma solicitação de reimpressão
  const createRequestMutation = useMutation({
    mutationFn: async (data: {
      activityId: number;
      quantity: number;
      reason: string;
      details?: string;
      priority: string;
      requestedBy: string;
    }) => {
      const res = await apiRequest("POST", "/api/reprint-requests", data);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Solicitação enviada",
        description: "A solicitação de reimpressão foi enviada com sucesso.",
      });
      
      // Invalidar queries para atualizar os dados
      queryClient.invalidateQueries({ queryKey: ["/api/department/batida/reprint-requests"] });
      
      // Resetar o formulário
      resetForm();
      
      // Fechar o modal
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Erro ao solicitar reimpressão",
        description: error.message || "Ocorreu um erro ao enviar a solicitação.",
        variant: "destructive",
      });
    },
  });
  
  // Função para limpar o formulário
  const resetForm = () => {
    setQuantity(1);
    setReason("");
    setDetails("");
    setPriority("normal");
    setRequestedBy("");
  };
  
  // Lógica para o envio do formulário
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!activity) {
      toast({
        title: "Erro",
        description: "Nenhuma atividade selecionada.",
        variant: "destructive",
      });
      return;
    }
    
    if (quantity <= 0) {
      toast({
        title: "Quantidade inválida",
        description: "A quantidade deve ser maior que zero.",
        variant: "destructive",
      });
      return;
    }
    
    if (!reason.trim()) {
      toast({
        title: "Motivo obrigatório",
        description: "Por favor, informe o motivo da reimpressão.",
        variant: "destructive",
      });
      return;
    }
    
    if (!requestedBy.trim()) {
      toast({
        title: "Nome obrigatório",
        description: "Por favor, informe quem está solicitando a reimpressão.",
        variant: "destructive",
      });
      return;
    }
    
    // Enviar solicitação
    createRequestMutation.mutate({
      activityId: activity.id,
      quantity,
      reason,
      details: details || undefined,
      priority,
      requestedBy,
    });
  };
  
  // Se não tiver atividade, não renderiza nada
  if (!activity) return null;
  
  return (
    <Dialog open={isOpen} onOpenChange={() => {
      // Ao fechar, limpar o formulário
      if (isOpen) resetForm();
      onClose();
    }}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Solicitar Reimpressão</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Informações da atividade */}
          <div className="bg-muted/30 p-3 rounded-md">
            <h3 className="font-medium mb-1">{activity.title}</h3>
            <p className="text-sm text-muted-foreground">{activity.description}</p>
          </div>
          
          {/* Quantidade */}
          <div className="space-y-2">
            <Label htmlFor="quantity" className="required">Quantidade</Label>
            <Input 
              id="quantity"
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
              min={1}
              required
            />
            <p className="text-xs text-muted-foreground">
              Número de peças que precisam ser reimpressas.
            </p>
          </div>
          
          {/* Motivo */}
          <div className="space-y-2">
            <Label htmlFor="reason" className="required">Motivo</Label>
            <Input 
              id="reason"
              placeholder="Motivo da reimpressão"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">
              Motivo principal pelo qual as peças precisam ser reimpressas.
            </p>
          </div>
          
          {/* Detalhes adicionais */}
          <div className="space-y-2">
            <Label htmlFor="details">Detalhes adicionais</Label>
            <Textarea 
              id="details"
              placeholder="Detalhes adicionais sobre o problema"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              Informações adicionais que possam ajudar na reimpressão.
            </p>
          </div>
          
          {/* Prioridade */}
          <div className="space-y-2">
            <Label>Prioridade</Label>
            <RadioGroup value={priority} onValueChange={setPriority} className="flex gap-4">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="normal" id="normal" />
                <Label htmlFor="normal" className="font-normal">Normal</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="urgent" id="urgent" />
                <Label htmlFor="urgent" className="font-normal">Urgente</Label>
              </div>
            </RadioGroup>
            <p className="text-xs text-muted-foreground">
              Selecione "Urgente" apenas para casos que realmente precisam de atenção imediata.
            </p>
          </div>
          
          {/* Solicitado por */}
          <div className="space-y-2">
            <Label htmlFor="requested-by" className="required">Solicitado por</Label>
            <Input 
              id="requested-by"
              placeholder="Seu nome"
              value={requestedBy}
              onChange={(e) => setRequestedBy(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">
              Informe seu nome para identificação.
            </p>
          </div>
          
          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={onClose}
            >
              Cancelar
            </Button>
            <Button 
              type="submit"
              disabled={createRequestMutation.isPending}
            >
              {createRequestMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : "Solicitar Reimpressão"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}