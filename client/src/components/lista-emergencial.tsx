import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle, X, RefreshCw, Info } from "lucide-react";
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
  activityTitle?: string; // Título da atividade
  activityImage?: string; // URL da imagem da atividade
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

interface Activity {
  id: number;
  title: string;
  client: string;
  image?: string; // URL da imagem da atividade
}

interface ListaEmergencialProps {
  department: string;
  activities: Activity[];
  refreshInterval?: number; // em ms, padrão 5000 (5s)
}

export default function ListaEmergencial({ department, activities, refreshInterval = 5000 }: ListaEmergencialProps) {
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
  
  const isImpressao = department === "impressao";
  
  // Função para carregar solicitações
  const carregarSolicitacoes = async () => {
    try {
      setError(null);
      
      const response = await fetch("/api/reimpressao-emergencial/listar");
      
      if (!response.ok) {
        throw new Error("Erro ao carregar solicitações");
      }
      
      const data = await response.json();
      console.log("📋 Solicitações carregadas:", data);
      
      setSolicitacoes(data);
    } catch (err) {
      console.error("❌ Erro ao carregar solicitações:", err);
      setError(err instanceof Error ? err.message : "Erro desconhecido");
      
      toast({
        title: "Erro ao carregar solicitações",
        description: err instanceof Error ? err.message : "Ocorreu um erro ao carregar as solicitações",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };
  
  // Efeito para carregar solicitações
  useEffect(() => {
    carregarSolicitacoes();
    
    // Configurar intervalo de atualização
    const intervalId = setInterval(() => {
      carregarSolicitacoes();
    }, refreshInterval);
    
    // Limpar intervalo quando componente for desmontado
    return () => clearInterval(intervalId);
  }, [refreshInterval, refreshKey]);
  
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
      const response = await fetch(`/api/reimpressao-emergencial/${selectedSolicitacao.id}/processar`, {
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
  
  // Filtrar solicitações com base no departamento e status
  const filtrarSolicitacoes = () => {
    if (isImpressao) {
      // Para setor de impressão, mostrar solicitações que o Batida enviou
      const pendentes = solicitacoes.filter(s => s.toDepartment === "impressao" && s.status === "pendente");
      const concluidas = solicitacoes.filter(s => s.toDepartment === "impressao" && s.status === "concluida");
      const rejeitadas = solicitacoes.filter(s => s.toDepartment === "impressao" && s.status === "rejeitada");
      
      return { pendentes, concluidas, rejeitadas };
    } else {
      // Para setor de batida, mostrar solicitações que eles enviaram
      const pendentes = solicitacoes.filter(s => s.fromDepartment === "batida" && s.status === "pendente");
      const concluidas = solicitacoes.filter(s => s.fromDepartment === "batida" && s.status === "concluida");
      const rejeitadas = solicitacoes.filter(s => s.fromDepartment === "batida" && s.status === "rejeitada");
      
      return { pendentes, concluidas, rejeitadas };
    }
  };
  
  const { pendentes, concluidas, rejeitadas } = filtrarSolicitacoes();
  
  // Obter título da atividade pelo ID
  const getActivityTitle = (activityId: number, activityTitle?: string) => {
    // Se já temos o título na solicitação, usar esse
    if (activityTitle) return activityTitle;
    // Caso contrário, procurar na lista de atividades
    const activity = activities.find(a => a.id === activityId);
    return activity ? activity.title : `Pedido #${activityId}`;
  };
  
  // Obter imagem da atividade
  const getActivityImage = (activityId: number, activityImage?: string): string | undefined => {
    // Se já temos a imagem na solicitação, usar essa
    if (activityImage) return activityImage;
    // Caso contrário, procurar na lista de atividades
    const activity = activities.find(a => a.id === activityId);
    return activity?.image;
  };
  
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
    <Card className="w-full mb-6">
      <CardHeader className="bg-blue-50 dark:bg-blue-900/20">
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="text-xl">
              {isImpressao ? "Solicitações de Reimpressão" : "Minhas Solicitações de Reimpressão"}
            </CardTitle>
            <CardDescription>
              {isImpressao 
                ? "Visualize e processe as solicitações de reimpressão do setor de Batida"
                : "Acompanhe o status das suas solicitações de reimpressão"}
            </CardDescription>
          </div>
          <Badge variant="outline" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">
            ULTRA RÁPIDO
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        <div className="p-4 border-b flex items-center justify-between">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
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
          </Tabs>
          
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
                          {getActivityImage(solicitacao.activityId, solicitacao.activityImage) && (
                            <div className="flex-shrink-0 w-12 h-12 rounded-md overflow-hidden border">
                              <img 
                                src={getActivityImage(solicitacao.activityId, solicitacao.activityImage)} 
                                alt="Miniatura do pedido" 
                                className="w-full h-full object-cover"
                                onError={(e) => (e.currentTarget.style.display = 'none')}
                              />
                            </div>
                          )}
                          <div>
                            <h3 className="font-medium">
                              {getActivityTitle(solicitacao.activityId, solicitacao.activityTitle)}
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
                      
                      {isImpressao && (
                        <div className="mt-3 flex justify-end">
                          <Button 
                            onClick={() => abrirDialogProcessamento(solicitacao)}
                            className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-800 dark:hover:bg-blue-700"
                            size="sm"
                          >
                            Processar solicitação
                          </Button>
                        </div>
                      )}
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
                          {getActivityImage(solicitacao.activityId, solicitacao.activityImage) && (
                            <div className="flex-shrink-0 w-12 h-12 rounded-md overflow-hidden border">
                              <img 
                                src={getActivityImage(solicitacao.activityId, solicitacao.activityImage)} 
                                alt="Miniatura do pedido" 
                                className="w-full h-full object-cover"
                                onError={(e) => (e.currentTarget.style.display = 'none')}
                              />
                            </div>
                          )}
                          <div>
                            <h3 className="font-medium">
                              {getActivityTitle(solicitacao.activityId, solicitacao.activityTitle)}
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
                        {solicitacao.processedBy && (
                          <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                            Concluído por {solicitacao.processedBy} em {formatarData(solicitacao.processedAt!)}
                          </p>
                        )}
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
                          {getActivityImage(solicitacao.activityId, solicitacao.activityImage) && (
                            <div className="flex-shrink-0 w-12 h-12 rounded-md overflow-hidden border">
                              <img 
                                src={getActivityImage(solicitacao.activityId, solicitacao.activityImage)} 
                                alt="Miniatura do pedido" 
                                className="w-full h-full object-cover"
                                onError={(e) => (e.currentTarget.style.display = 'none')}
                              />
                            </div>
                          )}
                          <div>
                            <h3 className="font-medium">
                              {getActivityTitle(solicitacao.activityId, solicitacao.activityTitle)}
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
                        {solicitacao.processedBy && (
                          <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                            Rejeitado por {solicitacao.processedBy} em {formatarData(solicitacao.processedAt!)}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </>
        )}
      </CardContent>
      
      {/* Dialog para processar solicitação */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Processar solicitação</DialogTitle>
            <DialogDescription>
              Preencha as informações abaixo para processar esta solicitação.
            </DialogDescription>
          </DialogHeader>
          
          {selectedSolicitacao && (
            <div className="py-4">
              <div className="mb-4 p-3 bg-muted rounded-md">
                <div className="flex items-start gap-3 mb-2">
                  {/* Imagem da atividade como miniatura */}
                  {getActivityImage(selectedSolicitacao.activityId, selectedSolicitacao.activityImage) && (
                    <div className="flex-shrink-0 w-16 h-16 rounded-md overflow-hidden border">
                      <img 
                        src={getActivityImage(selectedSolicitacao.activityId, selectedSolicitacao.activityImage)} 
                        alt="Miniatura do pedido" 
                        className="w-full h-full object-cover"
                        onError={(e) => (e.currentTarget.style.display = 'none')}
                      />
                    </div>
                  )}
                  <div>
                    <p className="font-medium">{getActivityTitle(selectedSolicitacao.activityId, selectedSolicitacao.activityTitle)}</p>
                    <p className="text-sm">Solicitado por: {selectedSolicitacao.requestedBy}</p>
                    <p className="text-sm">Motivo: {selectedSolicitacao.reason}</p>
                    <p className="text-sm">Quantidade: {selectedSolicitacao.quantity}</p>
                  </div>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="processedBy">Seu nome *</Label>
                  <Input
                    id="processedBy"
                    value={processedBy}
                    onChange={(e) => setProcessedBy(e.target.value)}
                    placeholder="Digite seu nome"
                    disabled={processing}
                    required
                  />
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter className="flex justify-between items-center gap-2">
            <DialogClose asChild>
              <Button variant="outline" disabled={processing}>
                Cancelar
              </Button>
            </DialogClose>
            
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="border-red-200 bg-red-50 text-red-800 hover:bg-red-100 hover:text-red-900 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300 dark:hover:bg-red-900/40"
                disabled={processing}
                onClick={() => processarSolicitacao("rejeitada")}
              >
                {processing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <X className="h-4 w-4 mr-1" />
                    Rejeitar
                  </>
                )}
              </Button>
              
              <Button
                className="bg-green-600 hover:bg-green-700 dark:bg-green-800 dark:hover:bg-green-700"
                disabled={processing}
                onClick={() => processarSolicitacao("concluida")}
              >
                {processing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Concluir
                  </>
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}