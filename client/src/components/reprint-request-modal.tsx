import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Activity } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface ReprintRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  activity: Activity;
}

export default function ReprintRequestModal({ isOpen, onClose, activity }: ReprintRequestModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [quantity, setQuantity] = useState<number>(1);
  const [reason, setReason] = useState<string>("");
  const [details, setDetails] = useState<string>("");
  const [requestedBy, setRequestedBy] = useState<string>("");
  const [priority, setPriority] = useState<"normal" | "urgent">("normal");
  
  const reprintMutation = useMutation({
    mutationFn: async (data: {
      activityId: number;
      quantity: number;
      reason: string;
      details?: string;
      requestedBy: string;
      priority: "normal" | "urgent";
    }) => {
      const res = await apiRequest("POST", "/api/reprint-requests", data);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Solicitação de reimpressão enviada",
        description: "O setor de impressão foi notificado e irá processar sua solicitação.",
      });
      
      // Invalidar qualquer cache relacionado a reimpressões
      queryClient.invalidateQueries({ queryKey: ["/api/department/batida/reprint-requests"] });
      
      // Limpar o formulário
      setQuantity(1);
      setReason("");
      setDetails("");
      setRequestedBy("");
      setPriority("normal");
      
      // Fechar o modal
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Erro ao solicitar reimpressão",
        description: error.message || "Ocorreu um erro ao solicitar a reimpressão. Tente novamente.",
        variant: "destructive",
      });
    },
  });
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validação básica
    if (!requestedBy.trim()) {
      toast({
        title: "Campo obrigatório",
        description: "Por favor, informe quem está solicitando a reimpressão.",
        variant: "destructive",
      });
      return;
    }
    
    if (!reason.trim()) {
      toast({
        title: "Campo obrigatório",
        description: "Por favor, informe o motivo da reimpressão.",
        variant: "destructive",
      });
      return;
    }
    
    if (quantity < 1) {
      toast({
        title: "Quantidade inválida",
        description: "A quantidade deve ser maior que zero.",
        variant: "destructive",
      });
      return;
    }
    
    // Enviar solicitação
    reprintMutation.mutate({
      activityId: activity.id,
      quantity,
      reason,
      details: details || undefined,
      requestedBy,
      priority,
    });
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Solicitar Reimpressão</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="activity-title">Pedido</Label>
            <Input 
              id="activity-title" 
              value={activity.title} 
              disabled
              className="bg-muted"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="requested-by" className="required">Solicitado por</Label>
              <Input 
                id="requested-by" 
                value={requestedBy} 
                onChange={(e) => setRequestedBy(e.target.value)}
                placeholder="Nome do solicitante"
                required
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="quantity" className="required">Quantidade</Label>
              <Input 
                id="quantity" 
                type="number" 
                min={1}
                max={activity.quantity}
                value={quantity} 
                onChange={(e) => setQuantity(Number(e.target.value))}
                required
              />
            </div>
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="priority">Prioridade</Label>
            <RadioGroup defaultValue="normal" value={priority} onValueChange={(val: "normal" | "urgent") => setPriority(val)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="normal" id="normal" />
                <Label htmlFor="normal">Normal</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="urgent" id="urgent" />
                <Label htmlFor="urgent">Urgente</Label>
              </div>
            </RadioGroup>
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="reason" className="required">Motivo da reimpressão</Label>
            <Textarea 
              id="reason" 
              placeholder="Ex: Peça com defeito, erro na impressão, etc."
              value={reason} 
              onChange={(e) => setReason(e.target.value)}
              required
            />
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="details">Detalhes adicionais</Label>
            <Textarea 
              id="details" 
              placeholder="Informações adicionais que possam ajudar o setor de impressão"
              value={details} 
              onChange={(e) => setDetails(e.target.value)}
            />
          </div>
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button 
              type="submit" 
              disabled={reprintMutation.isPending}
            >
              {reprintMutation.isPending ? (
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