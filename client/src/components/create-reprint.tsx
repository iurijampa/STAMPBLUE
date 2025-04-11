import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export default function CreateReprintRequest() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Função para criar uma solicitação de teste
  const createTestRequest = async () => {
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/reimpressao-emergencial/criar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          activityId: 48,
          activityTitle: "GS IPHONE - Teste de Imagem",
          activityImage: "/uploads/activity_48.jpg",
          requestedBy: "Teste de Imagem",
          reason: "Teste da exibição de imagem",
          details: "Esta solicitação testa se as imagens dos pedidos estão sendo exibidas corretamente",
          quantity: 3,
          fromDepartment: "batida",
          toDepartment: "impressao"
        })
      });
      
      if (!response.ok) {
        throw new Error(`Erro ao criar solicitação: ${response.status}`);
      }
      
      const data = await response.json();
      
      toast({
        title: "Solicitação criada com sucesso",
        description: "A solicitação de teste foi criada e deve aparecer na lista."
      });
      
      console.log("Solicitação criada:", data);
    } catch (error) {
      console.error("Erro ao criar solicitação:", error);
      
      toast({
        title: "Erro ao criar solicitação",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="mt-4">
      <Button 
        onClick={createTestRequest} 
        disabled={isLoading}
        className="w-full bg-blue-600 hover:bg-blue-700"
      >
        {isLoading ? "Criando..." : "Criar Solicitação de Teste"}
      </Button>
      <p className="text-xs text-muted-foreground mt-1 text-center">
        Clique para adicionar uma solicitação de teste ao sistema
      </p>
    </div>
  );
}