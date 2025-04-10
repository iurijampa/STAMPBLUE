import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface SuperSimpleReprintProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

/**
 * Componente ultra-simplificado para reimpressão de emergência
 * Sem formulários complexos, apenas um botão para enviar a solicitação
 */
export function SuperSimpleReprint({ isOpen, onClose, onSuccess }: SuperSimpleReprintProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      console.log("Enviando solicitação de reimpressão de emergência");
      
      // Fazemos a solicitação para a rota ultra-simplificada
      const response = await fetch("/api/reimpressao-emergencia", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          timestamp: Date.now()
        }),
        credentials: "include"
      });

      if (!response.ok) {
        throw new Error("Falha ao criar reimpressão de emergência");
      }

      toast({
        title: "Reimpressão Solicitada!",
        description: "Sua solicitação de reimpressão foi enviada com sucesso para o setor de impressão",
        variant: "default",
      });

      if (onSuccess) {
        onSuccess();
      }
      
      onClose();
    } catch (error) {
      console.error("Erro ao enviar reimpressão:", error);
      toast({
        title: "Erro",
        description: "Houve um problema ao enviar a solicitação de reimpressão",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Solicitar Reimpressão Emergencial</DialogTitle>
        </DialogHeader>
        
        <div className="py-6">
          <p className="text-center text-neutral-700 text-lg">
            Esta solicitação de reimpressão será enviada diretamente para o setor de impressão.
          </p>
          <p className="text-center mt-2 text-neutral-700">
            Clique no botão abaixo para enviar a solicitação de emergência.
          </p>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Enviando...
              </>
            ) : (
              "Enviar Reimpressão Urgente"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}