import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Badge } from "./ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { toast } from "@/hooks/use-toast";
import { CalendarClock, Printer } from "lucide-react";
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface SolicitacaoReimpressao {
  id: number;
  activityId: number;
  requestedBy: string;
  reason: string;
  details?: string;
  quantity: number;
  status: string;
  createdAt: string;
  fromDepartment: string;
  toDepartment: string;
}

export default function ListaReimpressaoSimples() {
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoReimpressao[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tabAtual, setTabAtual] = useState("pendentes");

  // Carregar solicitações
  const carregarSolicitacoes = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch("/api/reimpressao-simples/listar");
      
      if (!response.ok) {
        throw new Error("Falha ao buscar solicitações");
      }
      
      const data = await response.json();
      setSolicitacoes(data);
      
    } catch (error) {
      console.error("Erro ao carregar solicitações:", error);
      setError(error instanceof Error ? error.message : "Erro desconhecido");
      toast({
        title: "Erro ao carregar solicitações",
        description: error instanceof Error ? error.message : "Falha na comunicação com o servidor",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Carregar na inicialização
  useEffect(() => {
    carregarSolicitacoes();
    
    // Recarregar a cada 30 segundos
    const intervalId = setInterval(carregarSolicitacoes, 30000);
    
    return () => clearInterval(intervalId);
  }, []);
  
  // Filtrar solicitações por status
  const solicitacoesPendentes = solicitacoes.filter(s => s.status === "pendente");
  const solicitacoesCompletadas = solicitacoes.filter(s => s.status === "concluida");
  const solicitacoesRejeitadas = solicitacoes.filter(s => s.status === "rejeitada");
  
  // Formatação de data relativa
  const formatarDataRelativa = (dataString: string) => {
    try {
      const data = new Date(dataString);
      return formatDistanceToNow(data, { addSuffix: true, locale: ptBR });
    } catch (error) {
      return dataString;
    }
  };
  
  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl">Solicitações de Reimpressão</CardTitle>
            <CardDescription>
              Lista de solicitações de reimpressão enviadas e recebidas
            </CardDescription>
          </div>
          <Button 
            variant="outline" 
            size="sm"
            onClick={carregarSolicitacoes}
            disabled={isLoading}
          >
            {isLoading ? "Carregando..." : "Atualizar"}
          </Button>
        </div>
      </CardHeader>
      
      <CardContent>
        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-md mb-4">
            {error}
          </div>
        )}
        
        <Tabs defaultValue="pendentes" value={tabAtual} onValueChange={setTabAtual}>
          <TabsList className="mb-4">
            <TabsTrigger value="pendentes">
              Pendentes ({solicitacoesPendentes.length})
            </TabsTrigger>
            <TabsTrigger value="concluidas">
              Concluídas ({solicitacoesCompletadas.length})
            </TabsTrigger>
            <TabsTrigger value="rejeitadas">
              Rejeitadas ({solicitacoesRejeitadas.length})
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="pendentes">
            {renderTabelaSolicitacoes(solicitacoesPendentes, formatarDataRelativa)}
          </TabsContent>
          
          <TabsContent value="concluidas">
            {renderTabelaSolicitacoes(solicitacoesCompletadas, formatarDataRelativa)}
          </TabsContent>
          
          <TabsContent value="rejeitadas">
            {renderTabelaSolicitacoes(solicitacoesRejeitadas, formatarDataRelativa)}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

// Função auxiliar para renderizar tabela
function renderTabelaSolicitacoes(
  solicitacoes: SolicitacaoReimpressao[], 
  formatarData: (data: string) => string
) {
  if (solicitacoes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center text-gray-500">
        <Printer className="h-12 w-12 mb-2 text-gray-400" />
        <p className="text-lg font-medium">Nenhuma solicitação encontrada</p>
        <p className="text-sm">As solicitações aparecerão aqui quando forem criadas</p>
      </div>
    );
  }
  
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ID Pedido</TableHead>
            <TableHead>Solicitado por</TableHead>
            <TableHead>Motivo</TableHead>
            <TableHead>Quantidade</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>
              <div className="flex items-center space-x-1">
                <CalendarClock className="h-4 w-4" />
                <span>Criado</span>
              </div>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {solicitacoes.map((solicitacao) => (
            <TableRow key={solicitacao.id}>
              <TableCell className="font-medium">{solicitacao.activityId}</TableCell>
              <TableCell>{solicitacao.requestedBy}</TableCell>
              <TableCell>
                <div className="max-w-xs truncate" title={solicitacao.reason}>
                  {solicitacao.reason}
                </div>
              </TableCell>
              <TableCell>{solicitacao.quantity}</TableCell>
              <TableCell>
                <Badge
                  variant={
                    solicitacao.status === "pendente" ? "outline" :
                    solicitacao.status === "concluida" ? "default" : 
                    "destructive"
                  }
                >
                  {solicitacao.status}
                </Badge>
              </TableCell>
              <TableCell className="text-gray-500 text-sm">
                {formatarData(solicitacao.createdAt)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}