import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Badge } from "./ui/badge";
import { CheckCircle, AlertCircle, Clock } from "lucide-react";
import { toast } from "@/hooks/use-toast";
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

export default function ReimpressaoProcessamento() {
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoReimpressao[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<SolicitacaoReimpressao | null>(null);
  const [processedBy, setProcessedBy] = useState("");
  
  // Carregar solicitações
  const carregarSolicitacoes = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Usando o endpoint de API compartilhado do sistema emergencial
      const response = await fetch("/api/impressao-emergencial/listar");
      
      if (!response.ok) {
        throw new Error("Falha ao buscar solicitações");
      }
      
      const data = await response.json();
      // Filtrar apenas pendentes para o setor de impressão (o endpoint já filtra mas garantimos aqui)
      const pendentes = data.filter((s: SolicitacaoReimpressao) => 
        s.status === "pendente" && s.toDepartment === "impressao"
      );
      
      setSolicitacoes(pendentes);
      
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
  
  useEffect(() => {
    carregarSolicitacoes();
    
    // Recarregar a cada 30 segundos
    const intervalId = setInterval(carregarSolicitacoes, 30000);
    
    return () => clearInterval(intervalId);
  }, []);
  
  const processarSolicitacao = async (status: "concluida" | "rejeitada") => {
    if (!selectedRequest) return;
    if (!processedBy.trim()) {
      toast({
        title: "Erro de validação",
        description: "Informe seu nome para processar a solicitação",
        variant: "destructive"
      });
      return;
    }
    
    try {
      setIsLoading(true);
      
      // Enviar solicitação para API emergencial compartilhada
      const response = await fetch(`/api/impressao-emergencial/${selectedRequest.id}/processar`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: status,
          processedBy: processedBy,
        }),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.message || "Erro ao processar solicitação");
      }
      
      console.log("Resposta do servidor:", result);
      
      // Atualizar a lista local
      setSolicitacoes(solicitacoes.filter(s => s.id !== selectedRequest.id));
      
      // Limpar seleção
      setSelectedRequest(null);
      setProcessedBy("");
      
      toast({
        title: `Solicitação ${status === "concluida" ? "concluída" : "rejeitada"}`,
        description: `A solicitação foi ${status === "concluida" ? "concluída" : "rejeitada"} com sucesso`,
        variant: status === "concluida" ? "default" : "destructive"
      });
      
      // Recarregar dados
      carregarSolicitacoes();
      
    } catch (error) {
      console.error("Erro ao processar solicitação:", error);
      toast({
        title: "Erro ao processar solicitação",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const formatarDataRelativa = (dataString: string) => {
    try {
      const data = new Date(dataString);
      return formatDistanceToNow(data, { addSuffix: true, locale: ptBR });
    } catch (error) {
      return dataString;
    }
  };
  
  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Solicitações de Reimpressão Pendentes</CardTitle>
          <CardDescription>
            Lista de solicitações pendentes para o setor de impressão
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-md mb-4">
              {error}
            </div>
          )}
          
          {solicitacoes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-gray-500">
              <Clock className="h-12 w-12 mb-2 text-gray-400" />
              <p className="text-lg font-medium">Nenhuma solicitação pendente</p>
              <p className="text-sm">Não há solicitações aguardando processamento</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID Pedido</TableHead>
                    <TableHead>Solicitado por</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead>Quantidade</TableHead>
                    <TableHead>Criado</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {solicitacoes.map((s) => (
                    <TableRow key={s.id} className={selectedRequest?.id === s.id ? "bg-blue-50" : ""}>
                      <TableCell className="font-medium">{s.activityId}</TableCell>
                      <TableCell>{s.requestedBy}</TableCell>
                      <TableCell>
                        <div className="max-w-xs truncate" title={s.reason}>
                          {s.reason}
                        </div>
                      </TableCell>
                      <TableCell>{s.quantity}</TableCell>
                      <TableCell>{formatarDataRelativa(s.createdAt)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedRequest(s)}
                        >
                          Processar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      
      {selectedRequest && (
        <Card>
          <CardHeader>
            <CardTitle>Processar Solicitação #{selectedRequest.id}</CardTitle>
            <CardDescription>
              Solicitação para pedido {selectedRequest.activityId} - Quantidade: {selectedRequest.quantity}
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <h3 className="text-sm font-medium mb-1">Solicitado por:</h3>
                <p className="text-gray-700">{selectedRequest.requestedBy}</p>
              </div>
              
              <div>
                <h3 className="text-sm font-medium mb-1">Data da solicitação:</h3>
                <p className="text-gray-700">{formatarDataRelativa(selectedRequest.createdAt)}</p>
              </div>
            </div>
            
            <div>
              <h3 className="text-sm font-medium mb-1">Motivo:</h3>
              <p className="text-gray-700">{selectedRequest.reason}</p>
            </div>
            
            {selectedRequest.details && (
              <div>
                <h3 className="text-sm font-medium mb-1">Detalhes adicionais:</h3>
                <p className="text-gray-700 whitespace-pre-line">{selectedRequest.details}</p>
              </div>
            )}
            
            <div className="pt-4">
              <h3 className="text-sm font-medium mb-2">Processado por:</h3>
              <Input
                value={processedBy}
                onChange={(e) => setProcessedBy(e.target.value)}
                placeholder="Digite seu nome aqui"
              />
            </div>
          </CardContent>
          
          <CardFooter className="flex justify-between pt-2">
            <Button
              variant="outline"
              onClick={() => setSelectedRequest(null)}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            
            <div className="space-x-2">
              <Button
                variant="destructive"
                onClick={() => processarSolicitacao("rejeitada")}
                disabled={isLoading || !processedBy.trim()}
              >
                <AlertCircle className="h-4 w-4 mr-2" />
                Rejeitar
              </Button>
              
              <Button
                onClick={() => processarSolicitacao("concluida")}
                disabled={isLoading || !processedBy.trim()}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Concluir Reimpressão
              </Button>
            </div>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}