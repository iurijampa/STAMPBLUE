import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

export default function CreateReprintRequest() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Mutation para criar solicitação de reimpressão
  const createRequestMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/reimpressao-emergencial/criar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          activityId: 48,
          requestedBy: "Teste Automático",
          reason: "Teste da exibição de imagem",
          details: "Esta solicitação testa se as imagens dos pedidos estão sendo exibidas corretamente",
          quantity: 3,
          priority: "normal",
          fromDepartment: "batida",
          toDepartment: "impressao"
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Erro ao criar solicitação: ${response.status}`);
      }
      
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Solicitação criada com sucesso",
        description: "A solicitação de teste foi criada e deve aparecer na lista em instantes."
      });
      
      // Invalidar a consulta para atualizar a lista de solicitações
      queryClient.invalidateQueries({ 
        queryKey: ['/api/reimpressao-emergencial/listar']
      });
    },
    onError: (error: Error) => {
      console.error("Erro ao criar solicitação:", error);
      
      toast({
        title: "Erro ao criar solicitação",
        description: error.message || "Erro desconhecido ao conectar com o servidor",
        variant: "destructive"
      });
    }
  });

  // Função para criar uma solicitação de teste
  const createTestRequest = () => {
    createRequestMutation.mutate();
  };
  
  return (
    <div>
      <Button 
        onClick={createTestRequest} 
        disabled={createRequestMutation.isPending}
        className="w-full bg-blue-600 hover:bg-blue-700"
      >
        {createRequestMutation.isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Criando...
          </>
        ) : "Criar Solicitação de Teste"}
      </Button>
      <p className="text-xs text-muted-foreground mt-1 text-center">
        Clique para adicionar uma solicitação de teste ao sistema
      </p>
    </div>
  );
}