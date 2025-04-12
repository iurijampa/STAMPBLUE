import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

// Função que manipula a criação da solicitação
const createReprintRequest = async () => {
  console.log("⏳ Iniciando criação de solicitação de teste...");
  
  const requestData = {
    activityId: 53,
    requestedBy: "Teste Automático",
    reason: "Teste da exibição de imagem para Construtora",
    details: "Esta solicitação testa se as imagens dos pedidos estão sendo exibidas corretamente - CONSTRUTORA INOVAÇÃO",
    quantity: 1,
    priority: "normal",
    fromDepartment: "batida",
    toDepartment: "impressao"
  };
  
  console.log("📦 Dados da requisição:", requestData);
  
  const response = await fetch('/api/reimpressao-emergencial/criar', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify(requestData)
  });
  
  // Verificar se a resposta está OK
  if (!response.ok) {
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.indexOf("application/json") !== -1) {
      // É JSON, podemos tentar extrair a mensagem de erro
      const errorData = await response.json();
      throw new Error(errorData.message || `Erro ao criar solicitação: ${response.status}`);
    } else {
      // Não é JSON, talvez seja HTML de erro
      const errorText = await response.text();
      console.error("Resposta não-JSON recebida:", errorText.substring(0, 150) + "...");
      throw new Error(`Erro na requisição: ${response.status}. O servidor retornou formato inválido.`);
    }
  }
  
  // Se chegou aqui, está tudo OK
  console.log("✅ Solicitação criada com sucesso!");
  return await response.json();
};

export default function CreateReprintRequest() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Mutation para criar solicitação de reimpressão
  const createRequestMutation = useMutation({
    mutationFn: createReprintRequest,
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