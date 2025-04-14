import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import SolucaoEmergencial from "@/components/solucao-emergencial";
import { emergencyRequests } from "@/data/emergencia"; // Importando dados injetados diretamente

export default function TestPage() {
  const [testResult, setTestResult] = useState<string | null>(null);
  const { toast } = useToast();

  const criarSolicitacaoTeste = async () => {
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

      const data = await response.json();
      
      if (response.ok) {
        setTestResult(JSON.stringify(data, null, 2));
        toast({
          title: "Solicitação criada com sucesso",
          description: "A solicitação de teste foi criada com ID " + data.data?.id
        });
      } else {
        throw new Error(data.message || "Erro ao criar solicitação");
      }
    } catch (error) {
      console.error("Erro ao criar solicitação:", error);
      setTestResult("Erro: " + (error instanceof Error ? error.message : "Erro desconhecido"));
      toast({
        title: "Erro ao criar solicitação",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Página de Teste - Sistema Emergencial</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-md shadow-md">
            <h2 className="text-xl font-bold mb-4">Criar Solicitação de Teste</h2>
            <Button onClick={criarSolicitacaoTeste} className="w-full bg-blue-600 hover:bg-blue-700">
              Criar Solicitação de Teste
            </Button>
            
            {testResult && (
              <div className="mt-4 p-3 bg-gray-100 rounded-md">
                <h3 className="font-medium text-sm mb-2">Resultado:</h3>
                <pre className="text-xs overflow-auto whitespace-pre-wrap">{testResult}</pre>
              </div>
            )}
          </div>
        </div>
        
        <div>
          <div className="bg-white p-4 rounded-md shadow-md">
            <h2 className="text-xl font-bold mb-4">Visualização do Componente</h2>
            <div className="border rounded-md p-4">
              <SolucaoEmergencial departamento="batida" modoVisualizacao={true} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}