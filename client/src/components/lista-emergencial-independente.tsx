import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  DialogClose,
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

export default function ListaEmergencialIndependente() {
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedSolicitacao, setSelectedSolicitacao] = useState<Solicitacao | null>(null);
  const [processedBy, setProcessedBy] = useState("");
  const [processing, setProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState("pendentes");
  const [refreshKey, setRefreshKey] = useState(0); // Para forçar refresh
  
  const { toast } = useToast();
  
  // Função para carregar solicitações (específico para o setor de impressão)
  const carregarSolicitacoes = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Endpoint específico para o setor de impressão
      const endpoint = "/api/impressao-emergencial/listar";
      
      console.log(`🔍 Buscando solicitações emergenciais para o setor impressao`);
      const response = await fetch(endpoint);
      
      if (!response.ok) {
        throw new Error(`Erro ao carregar solicitações (${response.status})`);
      }
      
      const data = await response.json();
      console.log(`✅ Encontradas ${data.length} solicitações emergenciais para o setor impressao`);
      
      // Adicionar console.log para depuração
      console.log('Dados recebidos da API:', JSON.stringify(data));
      
      setSolicitacoes(data);
    } catch (err) {
      console.error("❌ Erro ao carregar solicitações:", err);
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  };
  
  // Efeito para carregar solicitações
  useEffect(() => {
    carregarSolicitacoes();
    
    // Configurar intervalo de atualização
    const intervalId = setInterval(() => {
      console.log("Aguardando intervalo entre polls (5/5s)");
      carregarSolicitacoes();
    }, 5000);
    
    // Limpar intervalo quando componente for desmontado
    return () => clearInterval(intervalId);
  }, [refreshKey]);
  
  // Função para abrir dialog de processamento
  const abrirDialogProcessamento = (solicitacao: Solicitacao) => {
    setSelectedSolicitacao(solicitacao);
    setProcessedBy("");
    setDialogOpen(true);
  };
  
  // Função para processar solicitação
  const processarSolicitacao = async (status: string) => {
    if (!selectedSolicitacao) return;
    
    // Validação
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
      const endpoint = `/api/impressao-emergencial/${selectedSolicitacao.id}/processar`;
      
      console.log(`🔄 Processando solicitação via endpoint: ${endpoint}`);
      const response = await fetch(endpoint, {
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
      
      const data = await response.json();
      console.log(`✅ Solicitação ${status === "concluida" ? "concluída" : "rejeitada"} com sucesso:`, data);
      
      // Atualizar lista
      setRefreshKey(prev => prev + 1);
      
      // Fechar dialog
      setDialogOpen(false);
      
      // Notificar sucesso
      toast({
        title: status === "concluida" ? "Solicitação concluída" : "Solicitação rejeitada",
        description: `A solicitação foi ${status === "concluida" ? "concluída" : "rejeitada"} com sucesso.`
      });
      
    } catch (err) {
      console.error("❌ Erro ao processar solicitação:", err);
      
      toast({
        title: "Erro ao processar solicitação",
        description: err instanceof Error ? err.message : "Ocorreu um erro ao processar a solicitação",
        variant: "destructive",
      });
      
    } finally {
      setProcessing(false);
    }
  };
  
  // Classificar solicitações com base no status
  const filtrarSolicitacoes = () => {
    const pendentes = solicitacoes.filter(s => s.status === "pendente");
    const concluidas = solicitacoes.filter(s => s.status === "concluida");
    const rejeitadas = solicitacoes.filter(s => s.status === "rejeitada");
    
    return { pendentes, concluidas, rejeitadas };
  };
  
  const { pendentes, concluidas, rejeitadas } = filtrarSolicitacoes();
  
  // Formatar data
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
  
  return (
    <div>
      <div className="p-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="p-4 border-b flex items-center justify-between">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="pendentes" className="relative">
                Pendentes
                {pendentes.length > 0 && (
                  <Badge className="ml-1 h-5 w-5 p-0 flex items-center justify-center rounded-full">
                    {pendentes.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="concluidas">Concluídas</TabsTrigger>
              <TabsTrigger value="rejeitadas">Rejeitadas</TabsTrigger>
            </TabsList>
            
            <Button variant="outline" size="sm" onClick={() => setRefreshKey(prev => prev + 1)} className="ml-2 flex-shrink-0">
              <RefreshCw className="h-4 w-4 mr-1" />
              Atualizar
            </Button>
          </div>
          
          {loading ? (
            <div className="py-10 flex flex-col items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">Carregando solicitações...</p>
            </div>
          ) : error ? (
            <div className="py-10 flex flex-col items-center justify-center">
              <AlertCircle className="h-8 w-8 text-red-500 mb-2" />
              <p className="text-sm text-red-500 mb-2">{error}</p>
              <Button variant="outline" size="sm" onClick={() => setRefreshKey(prev => prev + 1)}>
                Tentar novamente
              </Button>
            </div>
          ) : (
            <>
              <TabsContent value="pendentes" className="m-0">
                {pendentes.length === 0 ? (
                  <div className="py-10 text-center text-muted-foreground">
                    <Info className="h-8 w-8 mx-auto mb-2" />
                    <p>Não há solicitações pendentes no momento.</p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {pendentes.map(solicitacao => (
                    <div key={solicitacao.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-900/10">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-start gap-3">
                          {/* Imagem da atividade como miniatura */}
                          {solicitacao.activityImage && (
                            <div className="flex-shrink-0 w-12 h-12 rounded-md overflow-hidden border">
                              <img 
                                src={solicitacao.activityImage} 
                                alt="Miniatura do pedido" 
                                className="w-full h-full object-cover"
                                onError={(e) => (e.currentTarget.style.display = 'none')}
                              />
                            </div>
                          )}
                          <div>
                            <h3 className="font-medium">
                              {solicitacao.activityTitle || `Pedido #${solicitacao.activityId}`}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              Solicitado por: <span className="font-medium">{solicitacao.requestedBy}</span>
                            </p>
                          </div>
                        </div>
                        <Badge variant="outline" className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
                          Pendente
                        </Badge>
                      </div>
                      
                      <div className="text-sm mb-2">
                        <p><span className="font-medium">Motivo:</span> {solicitacao.reason}</p>
                        {solicitacao.details && (
                          <p><span className="font-medium">Detalhes:</span> {solicitacao.details}</p>
                        )}
                        <p><span className="font-medium">Quantidade:</span> {solicitacao.quantity}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Enviado em {formatarData(solicitacao.createdAt)}
                        </p>
                      </div>
                      
                      <div className="mt-3 flex justify-end">
                        <Button 
                          onClick={() => abrirDialogProcessamento(solicitacao)}
                          className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-800 dark:hover:bg-blue-700"
                          size="sm"
                        >
                          Processar solicitação
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="concluidas" className="m-0">
              {concluidas.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground">
                  <Info className="h-8 w-8 mx-auto mb-2" />
                  <p>Não há solicitações concluídas no momento.</p>
                </div>
              ) : (
                <div className="divide-y">
                  {concluidas.map(solicitacao => (
                    <div key={solicitacao.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-900/10">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-start gap-3">
                          {/* Imagem da atividade como miniatura */}
                          {solicitacao.activityImage && (
                            <div className="flex-shrink-0 w-12 h-12 rounded-md overflow-hidden border">
                              <img 
                                src={solicitacao.activityImage} 
                                alt="Miniatura do pedido" 
                                className="w-full h-full object-cover"
                                onError={(e) => (e.currentTarget.style.display = 'none')}
                              />
                            </div>
                          )}
                          <div>
                            <h3 className="font-medium">
                              {solicitacao.activityTitle || `Pedido #${solicitacao.activityId}`}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              Solicitado por: <span className="font-medium">{solicitacao.requestedBy}</span>
                            </p>
                          </div>
                        </div>
                        <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200">
                          Concluída
                        </Badge>
                      </div>
                      
                      <div className="text-sm mb-2">
                        <p><span className="font-medium">Motivo:</span> {solicitacao.reason}</p>
                        {solicitacao.details && (
                          <p><span className="font-medium">Detalhes:</span> {solicitacao.details}</p>
                        )}
                        <p><span className="font-medium">Quantidade:</span> {solicitacao.quantity}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Enviado em {formatarData(solicitacao.createdAt)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Processado por <span className="font-medium">{solicitacao.processedBy}</span> em {formatarData(solicitacao.processedAt || solicitacao.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="rejeitadas" className="m-0">
              {rejeitadas.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground">
                  <Info className="h-8 w-8 mx-auto mb-2" />
                  <p>Não há solicitações rejeitadas no momento.</p>
                </div>
              ) : (
                <div className="divide-y">
                  {rejeitadas.map(solicitacao => (
                    <div key={solicitacao.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-900/10">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-start gap-3">
                          {/* Imagem da atividade como miniatura */}
                          {solicitacao.activityImage && (
                            <div className="flex-shrink-0 w-12 h-12 rounded-md overflow-hidden border">
                              <img 
                                src={solicitacao.activityImage} 
                                alt="Miniatura do pedido" 
                                className="w-full h-full object-cover"
                                onError={(e) => (e.currentTarget.style.display = 'none')}
                              />
                            </div>
                          )}
                          <div>
                            <h3 className="font-medium">
                              {solicitacao.activityTitle || `Pedido #${solicitacao.activityId}`}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              Solicitado por: <span className="font-medium">{solicitacao.requestedBy}</span>
                            </p>
                          </div>
                        </div>
                        <Badge variant="outline" className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200">
                          Rejeitada
                        </Badge>
                      </div>
                      
                      <div className="text-sm mb-2">
                        <p><span className="font-medium">Motivo:</span> {solicitacao.reason}</p>
                        {solicitacao.details && (
                          <p><span className="font-medium">Detalhes:</span> {solicitacao.details}</p>
                        )}
                        <p><span className="font-medium">Quantidade:</span> {solicitacao.quantity}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Enviado em {formatarData(solicitacao.createdAt)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Rejeitado por <span className="font-medium">{solicitacao.processedBy}</span> em {formatarData(solicitacao.processedAt || solicitacao.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </>
        )}
      </div>
      
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
              
              <div className="border p-3 rounded-md bg-slate-50 dark:bg-slate-900/50">
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