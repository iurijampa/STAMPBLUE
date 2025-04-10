import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "./ui/table";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { RefreshCcw, AlertCircle } from "lucide-react";

interface Solicitacao {
  id: number;
  activityId: number;
  requestedBy: string;
  reason: string;
  details?: string;
  quantity: number;
  status: string;
  createdAt: string;
  processadoPor?: string;
  atualizadoEm?: string;
}

export default function ListaUltraSimples() {
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  
  const carregarSolicitacoes = async () => {
    try {
      setIsLoading(true);
      setErro(null);
      
      const response = await fetch("/api/reimpressao-ultrabasico/listar");
      
      if (!response.ok) {
        throw new Error("Erro ao buscar solicitações: " + response.status);
      }
      
      const data = await response.json();
      console.log("Dados carregados:", data);
      
      setSolicitacoes(Array.isArray(data) ? data : []);
      
    } catch (error) {
      console.error("Erro:", error);
      setErro(error instanceof Error ? error.message : "Erro desconhecido");
    } finally {
      setIsLoading(false);
    }
  };
  
  useEffect(() => {
    carregarSolicitacoes();
    
    // Atualizar a cada 30 segundos
    const interval = setInterval(carregarSolicitacoes, 30000);
    
    return () => clearInterval(interval);
  }, []);
  
  // Formatar data amigável
  const formatarData = (dataString: string) => {
    try {
      const data = new Date(dataString);
      return data.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return dataString;
    }
  };
  
  const getBadgeColor = (status: string) => {
    switch (status) {
      case 'pendente':
        return 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100';
      case 'concluida':
        return 'bg-green-100 text-green-800 hover:bg-green-100';
      case 'rejeitada':
        return 'bg-red-100 text-red-800 hover:bg-red-100';
      default:
        return 'bg-gray-100 text-gray-800 hover:bg-gray-100';
    }
  };
  
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle>Solicitações de Reimpressão (Ultra Simples)</CardTitle>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={carregarSolicitacoes} 
          disabled={isLoading}
        >
          <RefreshCcw className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
      </CardHeader>
      
      <CardContent>
        {erro && (
          <div className="bg-red-50 text-red-600 p-3 rounded-md mb-4 flex items-center">
            <AlertCircle className="h-5 w-5 mr-2" />
            {erro}
          </div>
        )}
        
        {isLoading && (
          <div className="flex justify-center py-8">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
          </div>
        )}
        
        {!isLoading && solicitacoes.length === 0 && (
          <div className="py-8 text-center text-muted-foreground">
            Nenhuma solicitação encontrada
          </div>
        )}
        
        {!isLoading && solicitacoes.length > 0 && (
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pedido</TableHead>
                  <TableHead>Solicitante</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Qtd.</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {solicitacoes.map((solicitacao) => (
                  <TableRow key={solicitacao.id}>
                    <TableCell className="font-medium">{solicitacao.activityId}</TableCell>
                    <TableCell>{solicitacao.requestedBy}</TableCell>
                    <TableCell>
                      <div className="max-w-[200px] truncate" title={solicitacao.reason}>
                        {solicitacao.reason}
                      </div>
                    </TableCell>
                    <TableCell>{solicitacao.quantity}</TableCell>
                    <TableCell>
                      <Badge className={getBadgeColor(solicitacao.status)}>
                        {solicitacao.status === 'pendente' ? 'Pendente' : 
                         solicitacao.status === 'concluida' ? 'Concluída' : 
                         solicitacao.status === 'rejeitada' ? 'Rejeitada' : 
                         solicitacao.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatarData(solicitacao.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}