import React, { useState } from "react";
import SolucaoReimpressao from "@/components/solucao-reimpressao";
import ListaReimpressaoSimples from "@/components/lista-reimpressao-simples";
import ReimpressaoProcessamento from "@/components/reimpressao-processamento";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function TestPage() {
  // Usar um ID fixo para teste
  const testeActivityId = 49; // ID de uma atividade que existe no sistema
  const testeActivityTitle = "CHAVEIRO INOVAÇÃO";
  const [atualizacaoPendente, setAtualizacaoPendente] = useState(false);

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
      
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-2xl">Instruções</CardTitle>
          <CardDescription>
            Esta é uma solução simplificada para o problema de reimpressão
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="mb-4">
            <strong>Como funciona:</strong> Esta versão ultrasimplificada armazena os dados na memória
            do servidor em vez de usar o banco de dados, contornando qualquer problema com o ORM ou PostgreSQL.
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Na aba <strong>CRIAR SOLICITAÇÃO</strong>: Preencha o formulário para criar uma solicitação de reimpressão</li>
            <li>Na aba <strong>LISTAR SOLICITAÇÕES</strong>: Veja todas as solicitações de reimpressão do sistema</li>
            <li>Os dados são armazenados em memória e persistem até o servidor ser reiniciado</li>
            <li>Esta solução contorna completamente os problemas de banco de dados</li>
          </ul>
          
          {atualizacaoPendente && (
            <div className="mt-4 p-3 bg-blue-50 text-blue-700 rounded border border-blue-200">
              ⚠️ Solicitação criada com sucesso! Vá para a aba "LISTAR SOLICITAÇÕES" para verificar
            </div>
          )}
        </CardContent>
      </Card>
      
      <div className="mt-8">
        <Tabs defaultValue="criar">
          <TabsList className="mb-6">
            <TabsTrigger value="criar">CRIAR SOLICITAÇÃO</TabsTrigger>
            <TabsTrigger value="listar">LISTAR SOLICITAÇÕES</TabsTrigger>
            <TabsTrigger value="processar">IMPRESSÃO - PROCESSAR</TabsTrigger>
          </TabsList>
          
          <TabsContent value="criar">
            <SolucaoReimpressao 
              activityId={testeActivityId} 
              activityTitle={testeActivityTitle}
              onSuccess={handleSolicitacaoCriada}
            />
          </TabsContent>
          
          <TabsContent value="listar">
            <ListaReimpressaoSimples />
          </TabsContent>
          
          <TabsContent value="processar">
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-md">
              <h3 className="font-medium text-amber-800 mb-1">Processamento (Setor de Impressão)</h3>
              <p className="text-amber-700 text-sm">
                Esta interface deve ser usada apenas pelo setor de impressão para processar solicitações de reimpressão.
              </p>
            </div>
            <ReimpressaoProcessamento />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}