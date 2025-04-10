import React, { useState } from "react";
import SolucaoReimpressao from "@/components/solucao-reimpressao";
import ListaReimpressaoSimples from "@/components/lista-reimpressao-simples";
import ReimpressaoProcessamento from "@/components/reimpressao-processamento";
import FormUltraSimples from "@/components/form-ultra-simples";
import ListaUltraSimples from "@/components/lista-ultra-simples";
import FormEmergencial from "@/components/form-emergencial";
import ListaEmergencial from "@/components/lista-emergencial";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, Megaphone } from "lucide-react";

export default function TestPage() {
  // Usar um ID fixo para teste
  const testeActivityId = 49; // ID de uma atividade que existe no sistema
  const testeActivityTitle = "CHAVEIRO INOVAÇÃO";
  const [atualizacaoPendente, setAtualizacaoPendente] = useState(false);
  
  // Mock dos dados para o teste da solução emergencial
  const testeActivity = {
    id: testeActivityId,
    title: testeActivityTitle,
    client: "Cliente Teste",
    description: "Descrição do pedido de teste"
  };
  
  const testeActivities = [
    { id: 47, title: "LUCIANO BRITO", client: "Cliente 1" },
    { id: 48, title: "GS IPHONE", client: "Cliente 2" },
    { id: 49, title: "CHAVEIRO INOVAÇÃO", client: "Cliente 3" },
    { id: 51, title: "POSTO INOVAÇÃO E CONVENIENCIA", client: "Cliente 4" }
  ];

  const handleSolicitacaoCriada = () => {
    // Indicar que uma nova solicitação foi criada
    setAtualizacaoPendente(true);
    
    // Aguardar um pouco e resetar o estado
    setTimeout(() => {
      setAtualizacaoPendente(false);
    }, 5000);
  };

  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold mb-6">Solução Simplificada - Reimpressão</h1>
      
      <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6 flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
        <div>
          <h3 className="font-medium text-red-800 mb-1">SOLUÇÃO EMERGENCIAL</h3>
          <p className="text-red-700 text-sm mb-2">
            Foram detectados problemas no sistema principal de reimpressão. 
            <strong> Utilize a versão ULTRA SIMPLIFICADA</strong> enquanto o problema é resolvido.
          </p>
          <p className="text-red-700 text-sm">
            A versão ultra simplificada não requer banco de dados e funciona de forma totalmente independente.
          </p>
        </div>
      </div>
      
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-2xl">Instruções</CardTitle>
          <CardDescription>
            Esta é uma solução ultrassimplificada para o problema de reimpressão
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="mb-4">
            <strong>Como funciona:</strong> Esta versão ultrassimplificada armazena os dados em memória (RAM)
            do servidor, contornando completamente o banco de dados e quaisquer problemas relacionados.
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Na aba <strong>VERSÃO ULTRA SIMPLIFICADA</strong>: Use este formulário simplificado para criar solicitações</li>
            <li>Na aba <strong>SOLICITAÇÕES ENVIADAS</strong>: Veja todas as solicitações de reimpressão criadas</li>
            <li>Os dados são armazenados apenas em memória do servidor, sem banco de dados</li>
            <li>Esta solução funciona independentemente do sistema principal</li>
          </ul>
          
          {atualizacaoPendente && (
            <div className="mt-4 p-3 bg-blue-50 text-blue-700 rounded border border-blue-200">
              ⚠️ Solicitação criada com sucesso! Vá para a aba "LISTAR SOLICITAÇÕES" para verificar
            </div>
          )}
        </CardContent>
      </Card>
      
      <div className="mt-8">
        <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-6 flex items-start gap-3">
          <Megaphone className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="font-medium text-blue-800 mb-1">NOVA SOLUÇÃO EMERGENCIAL DISPONÍVEL!</h3>
            <p className="text-blue-700 text-sm mb-2">
              Desenvolvemos uma nova versão <strong>SUPER RÁPIDA</strong> do sistema de reimpressão 
              que funciona diretamente na RAM do servidor, sem depender do banco de dados.
            </p>
            <p className="text-blue-700 text-sm">
              Utilize a aba <strong>VERSÃO EMERGENCIAL</strong> abaixo para acessar esta nova versão.
            </p>
          </div>
        </div>
        
        <Tabs defaultValue="emergencial-criar">
          <TabsList className="mb-6">
            <TabsTrigger value="emergencial-criar">VERSÃO EMERGENCIAL</TabsTrigger>
            <TabsTrigger value="emergencial-listar">SOLICITAÇÕES EMERGENCIAIS</TabsTrigger>
            <TabsTrigger value="ultra-simples">ULTRA SIMPLIFICADA</TabsTrigger>
            <TabsTrigger value="antiga">VERSÃO ANTIGA (NÃO USAR)</TabsTrigger>
          </TabsList>
          
          <TabsContent value="emergencial-criar">
            <FormEmergencial 
              activity={testeActivity}
              onSuccess={handleSolicitacaoCriada}
            />
          </TabsContent>
          
          <TabsContent value="emergencial-listar">
            <ListaEmergencial 
              department="batida"
              activities={testeActivities}
              refreshInterval={5000}
            />
            
            <ListaEmergencial 
              department="impressao"
              activities={testeActivities}
              refreshInterval={5000}
            />
          </TabsContent>
          
          <TabsContent value="ultra-simples">
            <div className="grid gap-6">
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-md">
                <h3 className="font-medium text-amber-800 mb-1">Versão Anterior (Ultra Simplificada)</h3>
                <p className="text-amber-700 text-sm">
                  Esta é a versão anterior da solução emergencial. Recomendamos usar a VERSÃO EMERGENCIAL.
                </p>
              </div>
              
              <FormUltraSimples />
              <ListaUltraSimples />
            </div>
          </TabsContent>
          
          <TabsContent value="antiga">
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <h3 className="font-medium text-red-800 mb-1">ATENÇÃO: Não utilize esta versão!</h3>
              <p className="text-red-700 text-sm">
                Esta versão possui problemas conhecidos. Por favor, utilize a VERSÃO EMERGENCIAL.
              </p>
            </div>
            
            <div className="grid gap-6">
              <SolucaoReimpressao 
                activityId={testeActivityId} 
                activityTitle={testeActivityTitle}
                onSuccess={handleSolicitacaoCriada}
              />
              <ListaReimpressaoSimples />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}