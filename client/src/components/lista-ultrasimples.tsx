import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle, X, RefreshCw, Info, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface Solicitacao {
  id: number;
  activityId: number;
  activityTitle?: string;
  activityImage?: string;
  requestedBy: string;
  reason: string;
  details?: string;
  quantity: number;
  status: string;
  createdAt: string;
  processedBy?: string;
  processedAt?: string;
  fromDepartment: string;
  toDepartment: string;
}

export default function ListaUltraSimples() {
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedSolicitacao, setSelectedSolicitacao] = useState<Solicitacao | null>(null);
  const [processedBy, setProcessedBy] = useState("");
  const [processing, setProcessing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  
  const { toast } = useToast();
  
  // Função para carregar solicitações do setor de impressão
  const carregarSolicitacoes = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch("/api/impressao-emergencial/listar");
      
      if (!response.ok) {
        throw new Error(`Erro ao carregar solicitações (${response.status})`);
      }
      
      const data = await response.json();
      console.log(`Solicitações emergenciais: ${data.length}`);
      console.log('Dados recebidos:', JSON.stringify(data));
      
      setSolicitacoes(data);
    } catch (err) {
      console.error("Erro ao carregar solicitações:", err);
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  };
  
  // Efeito para carregar solicitações e configurar atualização automática
  useEffect(() => {
    carregarSolicitacoes();
    
    const intervalId = setInterval(() => {
      carregarSolicitacoes();
    }, 5000);
    
    return () => clearInterval(intervalId);
  }, [refreshKey]);
  
  // Abrir dialog para processar solicitação
  const abrirDialogProcessamento = (solicitacao: Solicitacao) => {
    setSelectedSolicitacao(solicitacao);
    setProcessedBy("");
    setDialogOpen(true);
  };
  
  // Processar solicitação (concluir ou rejeitar)
  const processarSolicitacao = async (status: string) => {
    if (!selectedSolicitacao) return;
    
    if (!processedBy.trim()) {
      toast({
        title: "Erro",
        description: "Informe seu nome para processar a solicitação",
        variant: "destructive",
      });
      return;
    }
    
    setProcessing(true);
    
    try {
      const response = await fetch(`/api/impressao-emergencial/${selectedSolicitacao.id}/processar`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          status,
          processedBy: processedBy.trim()
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Erro ao processar solicitação");
      }
      
      // Atualizar lista e fechar dialog
      setRefreshKey(prev => prev + 1);
      setDialogOpen(false);
      
      toast({
        title: status === "concluida" ? "Solicitação concluída" : "Solicitação rejeitada",
        description: `A solicitação foi ${status === "concluida" ? "concluída" : "rejeitada"} com sucesso.`
      });
      
    } catch (err) {
      console.error("Erro ao processar solicitação:", err);
      
      toast({
        title: "Erro ao processar solicitação",
        description: err instanceof Error ? err.message : "Ocorreu um erro ao processar a solicitação",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };
  
  // Formatar data para exibição
  const formatarData = (dataString: string) => {
    const data = new Date(dataString);
    return data.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  // Filtragem de solicitações pendentes
  const solicitacoesPendentes = solicitacoes.filter(s => s.status === "pendente");
  
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div className="text-lg font-semibold">
          Solicitações de Reimpressão
          {solicitacoesPendentes.length > 0 && (
            <Badge className="ml-2 bg-blue-500">{solicitacoesPendentes.length}</Badge>
          )}
        </div>
        
        <Button variant="outline" size="sm" onClick={() => setRefreshKey(prev => prev + 1)}>
          <RefreshCw className="h-4 w-4 mr-1" />
          Atualizar
        </Button>
      </div>
      
      {loading ? (
        <div className="py-8 flex flex-col items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin mb-2" />
          <p className="text-sm text-muted-foreground">Carregando solicitações...</p>
        </div>
      ) : error ? (
        <div className="py-8 flex flex-col items-center justify-center">
          <AlertCircle className="h-8 w-8 text-red-500 mb-2" />
          <p className="text-sm text-red-500 mb-2">{error}</p>
          <Button variant="outline" size="sm" onClick={() => setRefreshKey(prev => prev + 1)}>
            Tentar novamente
          </Button>
        </div>
      ) : solicitacoesPendentes.length === 0 ? (
        <div className="py-8 text-center border rounded-md bg-gray-50">
          <Info className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-muted-foreground">Não há solicitações pendentes no momento.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {solicitacoesPendentes.map(solicitacao => (
            <Card key={solicitacao.id}>
              <CardHeader className="py-3">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-base">
                      {solicitacao.activityTitle || `Pedido #${solicitacao.activityId}`}
                    </CardTitle>
                    <CardDescription>
                      Solicitado por: {solicitacao.requestedBy}
                    </CardDescription>
                  </div>
                  <Badge className="bg-amber-500">Pendente</Badge>
                </div>
              </CardHeader>
              
              <CardContent className="py-2">
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-16 h-16 rounded-md overflow-hidden border">
                    <img 
                      src="/logo.svg" 
                      alt="Miniatura do pedido" 
                      className="w-full h-full object-cover bg-blue-600"
                    />
                  </div>
                  
                  <div className="flex-1 text-sm space-y-1">
                    <p><span className="font-medium">Motivo:</span> {solicitacao.reason}</p>
                    {solicitacao.details && (
                      <p><span className="font-medium">Detalhes:</span> {solicitacao.details}</p>
                    )}
                    <p><span className="font-medium">Quantidade:</span> {solicitacao.quantity}</p>
                    <p className="text-xs text-muted-foreground">
                      Enviado em {formatarData(solicitacao.createdAt)}
                    </p>
                    
                    <div className="pt-2">
                      <Button 
                        onClick={() => abrirDialogProcessamento(solicitacao)}
                        className="w-full bg-blue-600 hover:bg-blue-700"
                      >
                        Processar solicitação
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      
      {/* Dialog para processar solicitação */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Processar solicitação de reimpressão</DialogTitle>
            <DialogDescription>
              Informe seu nome para registrar quem processou esta solicitação.
            </DialogDescription>
          </DialogHeader>
          
          {selectedSolicitacao && (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="processedBy">Seu nome</Label>
                <Input
                  id="processedBy"
                  value={processedBy}
                  onChange={(e) => setProcessedBy(e.target.value)}
                  placeholder="Digite seu nome"
                  disabled={processing}
                />
              </div>
              
              <div className="border p-3 rounded-md bg-slate-50">
                <p className="text-sm font-medium">{selectedSolicitacao.activityTitle || `Pedido #${selectedSolicitacao.activityId}`}</p>
                <p className="text-sm"><span className="font-medium">Solicitado por:</span> {selectedSolicitacao.requestedBy}</p>
                <p className="text-sm"><span className="font-medium">Motivo:</span> {selectedSolicitacao.reason}</p>
                <p className="text-sm"><span className="font-medium">Quantidade:</span> {selectedSolicitacao.quantity}</p>
              </div>
            </div>
          )}
          
          <DialogFooter className="flex justify-between items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={processing}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => processarSolicitacao("rejeitada")}
              disabled={processing}
              className="flex-1"
            >
              {processing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <X className="h-4 w-4 mr-2" />
                  Rejeitar
                </>
              )}
            </Button>
            <Button
              onClick={() => processarSolicitacao("concluida")}
              disabled={processing}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              {processing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Concluir
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}