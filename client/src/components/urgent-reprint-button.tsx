import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Printer } from "lucide-react";

/**
 * Botão ultra-simplificado para solicitação rápida de reimpressão
 * Sem modal, sem formulário - apenas envia a solicitação diretamente ao servidor
 */
export function UrgentReprintButton() {
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async () => {
    try {
      setIsLoading(true);
      
      // Fazendo a chamada direta para a API de reimpressão
      const response = await fetch("/api/reimpressao-simples", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          timestamp: Date.now(),
          message: "Solicitação de reimpressão urgente da batida"
        }),
      });

      if (!response.ok) {
        throw new Error("Erro ao solicitar reimpressão");
      }

      // Mensagem de sucesso
      toast({
        title: "✅ Reimpressão solicitada!",
        description: "O setor de impressão foi notificado sobre a necessidade de reimpressão",
        variant: "default",
      });
      
      // Recarregar a página após breve atraso
      setTimeout(() => {
        window.location.reload();
      }, 1500);
      
    } catch (error) {
      console.error("Erro ao solicitar reimpressão:", error);
      toast({
        title: "Erro",
        description: "Houve um problema ao solicitar a reimpressão. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      variant="default"
      className="bg-red-600 hover:bg-red-700 text-white font-bold"
      onClick={handleClick}
      disabled={isLoading}
    >
      {isLoading ? (
        <span className="flex items-center gap-2">
          <span className="h-4 w-4 animate-spin rounded-full border-t-2 border-white"></span>
          Enviando...
        </span>
      ) : (
        <span className="flex items-center gap-2">
          <Printer className="h-4 w-4" />
          Solicitar Reimpressão Urgente
        </span>
      )}
    </Button>
  );
}