import React, { useEffect, useState, useMemo, useRef } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { 
  RefreshCw, Activity, Clock, Calendar, Users, ChevronRight, 
  AlertTriangle, AlertCircle, Layers, CheckCircle2, Bell, Eye, Edit, 
  Trash, Plus, Loader2, Search, ArrowUpCircle, ArrowDownCircle,
  Briefcase, Printer, Hammer, Scissors, Package, ChevronDown, ChevronUp,
  Pencil, Inbox
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import Layout from "@/components/Layout";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import ViewActivityModal from "@/components/view-activity-modal";
import CreateActivityModal from "@/components/create-activity-modal";
import EditActivityModal from "@/components/edit-activity-modal";
import { Activity as ActivityType } from "@shared/schema";

export default function AdminDashboard() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [currentTab, setCurrentTab] = useState<'production' | 'completed'>('production');
  
  // Verificar se é admin
  if (!user || user.role !== "admin") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-amber-500" />
          <h1 className="text-2xl font-bold mb-2">Acesso Restrito</h1>
          <p className="mb-4">Você não tem permissão para acessar esta página.</p>
          <Button onClick={() => navigate('/')}>Voltar para a página inicial</Button>
        </div>
      </div>
    );
  }
  
  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Painel do Administrador</h1>
          <Button variant="outline" onClick={() => navigate('/')}>
            Voltar para Página Inicial
          </Button>
        </div>
        
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="col-span-1">
              <StatsAndDepartmentsOverview />
            </div>
            <div className="col-span-1 md:col-span-2">
              <RecentActivities />
            </div>
          </div>
          
          {/* Seção de pedidos em produção */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between py-4">
                <div>
                  <CardTitle className="text-xl flex items-center">
                    <Layers className="h-5 w-5 mr-2 text-primary" />
                    Pedidos em Produção
                  </CardTitle>
                  <CardDescription>
                    Lista de todos os pedidos atualmente no fluxo de produção
                  </CardDescription>
                </div>
              </CardHeader>
              
              <CardContent>
                <ActivitiesList />
              </CardContent>
            </Card>
          </div>
        </div>
        
        {/* Abas para navegação */}
        <Tabs defaultValue="notifications" className="w-full mt-8">
          <TabsList className="w-full mb-4">
            <TabsTrigger value="notifications" className="flex-1">Notificações</TabsTrigger>
            <TabsTrigger value="users" className="flex-1">Gerenciar Usuários</TabsTrigger>
            <TabsTrigger value="stats" className="flex-1">Estatísticas</TabsTrigger>
          </TabsList>
          
          <TabsContent value="notifications">
            <div className="space-y-6">
              {/* Lista de notificações */}
              {NotificationsList()}
            </div>
          </TabsContent>
          
          <TabsContent value="users">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Gerenciamento de Usuários</CardTitle>
                  <CardDescription>
                    Administre todos os usuários do sistema
                  </CardDescription>
                </div>
                <Button 
                  onClick={() => navigate("/admin/users")}
                  className="flex items-center gap-1"
                >
                  <Users className="h-4 w-4 mr-1" />
                  Gerenciar Usuários
                </Button>
              </CardHeader>
              <CardContent>
                <div className="p-6 text-center">
                  <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-medium mb-2">Administração de Contas</h3>
                  <p className="text-muted-foreground mb-4">
                    Acesse a página de gerenciamento para criar, editar e excluir usuários do sistema.
                    Você pode definir permissões por departamento e controlar o acesso às funcionalidades.
                  </p>
                  <Button 
                    onClick={() => navigate("/admin/users")}
                    className="flex items-center gap-1 mx-auto"
                  >
                    Acessar Gerenciamento
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="stats">
            <Card>
              <CardHeader>
                <CardTitle>Estatísticas do Sistema</CardTitle>
                <CardDescription>
                  Métricas de utilização e performance da plataforma
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Estatísticas detalhadas serão implementadas em breve.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}

// Componente combinado para visão geral das estatísticas e departamentos
function StatsAndDepartmentsOverview() {
  // Dados para estatísticas
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["/api/stats"],
    queryFn: async () => {
      const response = await fetch("/api/stats");
      if (!response.ok) {
        throw new Error("Erro ao buscar estatísticas");
      }
      return response.json();
    },
    staleTime: 60000, // 1 minuto - estatísticas não precisam atualizar com frequência
    refetchOnWindowFocus: false // Melhora performance evitando recargas desnecessárias
  });

  // Dados para contadores de departamentos
  const [departmentCounts, setDepartmentCounts] = useState<any>(null);
  const [deptLoading, setDeptLoading] = useState(true);
  const [deptError, setDeptError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  
  const departmentIcons = {
    gabarito: <Briefcase className="h-5 w-5" />,
    impressao: <Printer className="h-5 w-5" />,
    batida: <Hammer className="h-5 w-5" />,
    costura: <Scissors className="h-5 w-5" />,
    embalagem: <Package className="h-5 w-5" />,
  };
  
  const departmentNames = {
    gabarito: "Gabarito",
    impressao: "Impressão",
    batida: "Batida",
    costura: "Costura",
    embalagem: "Embalagem",
  };
  
  // ULTRA OTIMIZAÇÃO: Usando a nova API especializada para o admin
  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();
    const signal = controller.signal;
    
    const fetchCounts = async () => {
      try {
        if (isMounted) setDeptLoading(true);
        if (isMounted) setDeptError(null);
        
        const timeoutId = setTimeout(() => {
          if (isMounted && deptLoading) {
            controller.abort();
            setDeptError("Tempo limite excedido ao carregar contadores");
            setDeptLoading(false);
          }
        }, 5000);
        
        // Usar a nova API otimizada para contagens de departamentos
        const response = await fetch("/api/admin-dashboard/department-stats", {
          signal,
          headers: {
            "Cache-Control": "max-age=30"
          }
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`Erro ao carregar contadores (${response.status})`);
        }
        
        const data = await response.json();
        console.log("[ULTRA OTIMIZAÇÃO] Contagens de departamentos carregadas com sucesso");
        
        if (isMounted) {
          setDepartmentCounts(data);
          setDeptLoading(false);
        }
      } catch (err) {
        if (isMounted && !signal.aborted) {
          console.error("Erro ao carregar contadores:", err);
          
          // Em caso de falha, tentar usar a API antiga como fallback
          try {
            if (isMounted) {
              console.log("[FALLBACK] Tentando API antiga para contagens de departamentos");
              const fallbackResponse = await fetch("/api/stats/department-counts");
              if (fallbackResponse.ok) {
                const fallbackData = await fallbackResponse.json();
                setDepartmentCounts(fallbackData);
              } else {
                setDeptError("Não foi possível carregar os contadores");
              }
            }
          } catch (fallbackErr) {
            setDeptError(err instanceof Error ? err.message : "Erro desconhecido");
          } finally {
            if (isMounted) setDeptLoading(false);
          }
        }
      }
    };
    
    fetchCounts();
    
    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [refreshKey]);

  const isLoading = statsLoading || deptLoading;

  return (
    <Card className="w-full">
      <CardHeader className="bg-gray-50 dark:bg-gray-800/50 py-3">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg flex items-center gap-2">
            Visão Geral do Sistema
          </CardTitle>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setRefreshKey(prev => prev + 1)}
            className="h-7 px-2"
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1" />
            Atualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-3">
        {isLoading ? (
          <div className="py-8 flex flex-col items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin mb-2" />
            <p className="text-sm text-muted-foreground">Carregando dados...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Estatísticas resumidas */}
            <div>
              <h3 className="text-sm mb-3 font-medium">Resumo de Pedidos</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="flex flex-col items-center p-3 bg-gray-50 dark:bg-gray-800/50 rounded-md">
                  <Activity className="h-5 w-5 text-primary mb-2" />
                  <span className="text-2xl font-bold">{stats?.total || 0}</span>
                  <p className="text-xs text-muted-foreground mt-1 text-center">
                    Total
                  </p>
                </div>
                
                <div className="flex flex-col items-center p-3 bg-amber-50 dark:bg-amber-950/20 rounded-md">
                  <Clock className="h-5 w-5 text-amber-500 mb-2" />
                  <span className="text-2xl font-bold">{stats?.inProgress || 0}</span>
                  <p className="text-xs text-muted-foreground mt-1 text-center">
                    Em Produção
                  </p>
                </div>
                
                <div className="flex flex-col items-center p-3 bg-green-50 dark:bg-green-950/20 rounded-md">
                  <CheckCircle2 className="h-5 w-5 text-green-500 mb-2" />
                  <span className="text-2xl font-bold">{stats?.completed || 0}</span>
                  <p className="text-xs text-muted-foreground mt-1 text-center">
                    Concluídos
                  </p>
                </div>
              </div>
            </div>
            
            {/* Contadores por departamento */}
            <div>
              <h3 className="text-sm mb-3 font-medium">Atividades por Departamento</h3>
              <div className="grid grid-cols-5 gap-2">
                {departmentCounts && 
                  // Ordem correta da linha de produção
                  ['gabarito', 'impressao', 'batida', 'costura', 'embalagem']
                  .filter(dept => departmentNames[dept as keyof typeof departmentNames])
                  .map(dept => [dept, departmentCounts[dept as keyof typeof departmentCounts]])
                  .map(([dept, count]) => (
                  <div key={dept} className="flex flex-col">
                    <div className={`py-2 px-3 rounded-t-md bg-${dept === 'gabarito' ? 'blue' : 
                      dept === 'impressao' ? 'violet' : 
                      dept === 'batida' ? 'amber' : 
                      dept === 'costura' ? 'emerald' : 
                      dept === 'embalagem' ? 'slate' : 'gray'}-600 text-white`}>
                      <div className="text-center text-sm font-medium flex justify-center items-center gap-1">
                        {departmentIcons[dept as keyof typeof departmentIcons]}
                        {departmentNames[dept as keyof typeof departmentNames]}
                      </div>
                    </div>
                    <div className="py-3 bg-white dark:bg-gray-950 border-x border-b rounded-b-md text-center">
                      <span className="text-2xl font-bold">{count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Componente para atividades recentes
function RecentActivities() {
  const { data: activities, isLoading } = useQuery({
    queryKey: ["/api/activities"],
    queryFn: async () => {
      const response = await fetch("/api/activities");
      if (!response.ok) {
        throw new Error("Erro ao buscar atividades");
      }
      return response.json();
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Atividades Recentes</CardTitle>
        <CardDescription>
          Últimas atividades cadastradas no sistema
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-4">
            <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full"></div>
          </div>
        ) : !activities || activities.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            Nenhuma atividade encontrada.
          </div>
        ) : (
          <div className="space-y-4">
            {activities.slice(0, 5).map((activity: any) => (
              <div key={activity.id} className="flex items-center gap-3 pb-3 border-b">
                <div className="w-10 h-10 rounded-md overflow-hidden border flex-shrink-0">
                  <img 
                    src={activity.image || "/placeholder.png"}
                    alt={activity.title}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = "/logo.svg";
                      e.currentTarget.classList.add("bg-blue-600");
                    }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{activity.title}</p>
                  <p className="text-sm text-muted-foreground">
                    ID: #{activity.id} • {new Date(activity.createdAt).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                {activity.priority && (
                  <div className="bg-red-100 text-red-800 px-2 py-0.5 rounded text-xs">
                    Prioridade
                  </div>
                )}
              </div>
            ))}
            <div className="mt-4 flex justify-end">
              <Button variant="outline" size="sm">
                Ver todos
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Departamentos disponíveis - definido fora do componente para evitar recriação, ordenados conforme linha de produção
const departmentOptions = [
  { value: null, label: "Todos os departamentos", icon: <Activity className="h-4 w-4 mr-1" /> },
  { value: "gabarito", label: "Gabarito", icon: <Briefcase className="h-4 w-4 mr-1" /> },
  { value: "impressao", label: "Impressão", icon: <Printer className="h-4 w-4 mr-1" /> },
  { value: "batida", label: "Batida", icon: <Hammer className="h-4 w-4 mr-1" /> },
  { value: "costura", label: "Costura", icon: <Scissors className="h-4 w-4 mr-1" /> },
  { value: "embalagem", label: "Embalagem", icon: <Package className="h-4 w-4 mr-1" /> },
];

// Componente para listar atividades em produção
function ActivitiesList() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedActivity, setSelectedActivity] = useState<ActivityType | null>(null);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterDepartment, setFilterDepartment] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  
  // Estado para paginação
  const [page, setPage] = useState(1);
  
  // Consulta usando o React Query para obter atividades em produção
  const { data: activitiesResponse, isLoading } = useQuery({
    queryKey: ["/api/admin-dashboard/activities", "producao", page, searchQuery, filterDepartment],
    queryFn: async () => {
      console.log("Buscando pedidos em produção, página", page);
      
      try {
        // Construir URL com parâmetros
        const url = new URL("/api/admin-dashboard/activities", window.location.origin);
        url.searchParams.append("status", "producao");
        url.searchParams.append("page", page.toString());
        url.searchParams.append("limit", "30");
        
        if (searchQuery) {
          url.searchParams.append("search", searchQuery);
        }
        
        if (filterDepartment) {
          url.searchParams.append("department", filterDepartment);
        }
        
        const response = await fetch(url.toString());
        
        if (!response.ok) {
          throw new Error(`Erro ao buscar atividades: ${response.status}`);
        }
        
        const data = await response.json();
        console.log(`Recebidos ${data.items.length} pedidos em produção`);
        return data;
      } catch (error) {
        console.error("Erro ao buscar pedidos:", error);
        throw error;
      }
    },
    staleTime: 10000, // 10 segundos (mais frequente)
    gcTime: 5 * 60 * 1000, // 5 minutos
    refetchInterval: 30000, // A cada 30 segundos
    retry: 3
  });
  
  // Extrair dados da resposta paginada
  const activities = activitiesResponse?.items || [];
  const totalItems = activitiesResponse?.total || 0;
  const totalPages = activitiesResponse?.totalPages || 1;
  
  // Função para abrir modal de visualização
  const handleView = (activity: ActivityType) => {
    setSelectedActivity(activity);
    setViewModalOpen(true);
  };
  
  // Função para abrir modal de edição
  const handleEdit = (activity: ActivityType) => {
    setSelectedActivity(activity);
    setEditModalOpen(true);
  };
  
  // Função para excluir atividade
  const handleDelete = async (id: number) => {
    if (confirm("Tem certeza que deseja excluir este pedido? Esta ação não pode ser desfeita.")) {
      try {
        const response = await fetch(`/api/activities/${id}`, {
          method: 'DELETE',
        });
        
        if (response.ok) {
          toast({
            title: "Sucesso",
            description: "Pedido excluído com sucesso",
          });
          
          // Invalidar todas as queries relacionadas para atualizar os dados
          queryClient.invalidateQueries({ queryKey: ["/api/activities"] });
          queryClient.invalidateQueries({ queryKey: ["/api/admin-dashboard/activities"] });
          queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
        } else {
          toast({
            title: "Erro",
            description: "Não foi possível excluir o pedido",
            variant: "destructive",
          });
        }
      } catch (error) {
        toast({
          title: "Erro",
          description: "Erro ao excluir pedido",
          variant: "destructive",
        });
      }
    }
  };
  
  // Verificar se um prazo está próximo ou vencido e retorna a classe de cor correspondente
  const getDeadlineStyle = (deadline: string) => {
    if (!deadline) return { color: "text-gray-500", badge: "Sem prazo" };
    
    try {
      const deadlineDate = new Date(deadline);
      const today = new Date();
      const diffDays = Math.floor((deadlineDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      if (diffDays < 0) {
        return { color: "text-red-500", badge: "Atrasado" };
      } else if (diffDays <= 3) {
        return { color: "text-amber-500", badge: "Próximo" };
      } else {
        return { color: "text-green-500", badge: "No prazo" };
      }
    } catch (e) {
      return { color: "text-gray-500", badge: "Data inválida" };
    }
  };
  
  // Formatar data para exibição
  const formatDate = (dateString: string) => {
    if (!dateString) return "Data não disponível";
    
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('pt-BR');
    } catch (e) {
      return "Data inválida";
    }
  };
  
  return (
    <div className="space-y-4">
      {/* Barra de filtros e ações */}
      <div className="flex flex-col sm:flex-row justify-between gap-3 mb-6">
        <div className="flex flex-1 max-w-md relative">
          <Input
            type="text"
            placeholder="Buscar pedidos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        </div>
        
        <div className="flex gap-2 flex-wrap">
          <Button 
            onClick={() => setCreateModalOpen(true)}
            className="flex items-center gap-1"
          >
            <Plus className="h-4 w-4" />
            Novo Pedido
          </Button>
        </div>
      </div>
      
      {/* Tabela de atividades */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full"></div>
        </div>
      ) : activities.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          Nenhum pedido em produção encontrado.
        </div>
      ) : (
        <>
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")} className="cursor-pointer">
                    ID {sortOrder === "asc" ? <ChevronUp className="inline h-3 w-3" /> : <ChevronDown className="inline h-3 w-3" />}
                  </TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead>Departamento</TableHead>
                  <TableHead>Data de Entrega</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activities.map((activity) => {
                  const deadlineStyle = getDeadlineStyle(activity.deadline);
                  
                  return (
                    <TableRow key={activity.id}>
                      <TableCell>{activity.id}</TableCell>
                      <TableCell>{activity.client}</TableCell>
                      <TableCell className="font-medium">{activity.title}</TableCell>
                      <TableCell>
                        {activity.department || activity.currentDepartment || "Não definido"}
                      </TableCell>
                      <TableCell className={deadlineStyle.color}>
                        {formatDate(activity.deadline)}
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => handleView(activity)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => handleEdit(activity)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => handleDelete(activity.id)}
                            className="text-red-500"
                          >
                            <Trash className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          
          {/* Paginação */}
          {totalPages > 1 && (
            <div className="flex justify-end space-x-2 mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={page === 1}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={page === totalPages}
              >
                Próxima
              </Button>
            </div>
          )}
        </>
      )}
      
      {/* Modais */}
      {selectedActivity && (
        <>
          <ViewActivityModal 
            isOpen={viewModalOpen} 
            onClose={() => setViewModalOpen(false)} 
            activity={selectedActivity}
          />
          <EditActivityModal 
            isOpen={editModalOpen}
            onClose={() => {
              setEditModalOpen(false);
              setSelectedActivity(null);
              queryClient.invalidateQueries({ queryKey: ["/api/admin-dashboard/activities"] });
            }}
            onSuccess={() => {
              setEditModalOpen(false);
              queryClient.invalidateQueries({ queryKey: ["/api/admin-dashboard/activities"] });
              toast({
                title: "Sucesso",
                description: "Pedido atualizado com sucesso",
              });
            }}
            activity={selectedActivity}
          />
        </>
      )}
      
      <CreateActivityModal 
        isOpen={createModalOpen}
        onClose={() => {
          setCreateModalOpen(false);
          queryClient.invalidateQueries({ queryKey: ["/api/admin-dashboard/activities"] });
        }}
        onSuccess={() => {
          setCreateModalOpen(false);
          queryClient.invalidateQueries({ queryKey: ["/api/admin-dashboard/activities"] });
          toast({
            title: "Sucesso",
            description: "Pedido criado com sucesso",
          });
        }}
      />
    </div>
  );
}

// Componente para listar notificações
function NotificationsList() {
  const { data: notifications, isLoading } = useQuery({
    queryKey: ["/api/notifications"],
    queryFn: async () => {
      const response = await fetch("/api/notifications");
      if (!response.ok) {
        throw new Error("Erro ao buscar notificações");
      }
      return response.json();
    },
    staleTime: 30000, // 30 segundos
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-amber-500" />
            <span>Notificações do Sistema</span>
            {notifications && notifications.length > 0 && (
              <Badge variant="destructive" className="ml-2">
                {notifications.length}
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Atualizações e notificações do sistema
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-4">
            <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full"></div>
          </div>
        ) : !notifications || notifications.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Bell className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
            <p>Você não tem novas notificações.</p>
          </div>
        ) : (
          <div className="space-y-4 max-h-[400px] overflow-y-auto">
            {notifications.map((notification: any) => {
              const isNew = notification.read === false;
              const activityId = notification.activityId;
              
              return (
                <div 
                  key={notification.id} 
                  className={`p-4 rounded-lg flex gap-3 ${
                    isNew ? 'bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800' : 'bg-gray-50 dark:bg-gray-800/50'
                  }`}
                >
                  <div className="flex-shrink-0">
                    {notification.type === 'status_update' ? (
                      <ArrowUpCircle className="h-6 w-6 text-blue-500" />
                    ) : notification.type === 'completed' ? (
                      <CheckCircle2 className="h-6 w-6 text-green-500" />
                    ) : notification.type === 'comment' ? (
                      <AlertCircle className="h-6 w-6 text-amber-500" />
                    ) : (
                      <Bell className="h-6 w-6 text-gray-400" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium mb-1">{notification.title}</div>
                    <p className="text-sm text-muted-foreground mb-2">{notification.message}</p>
                    <div className="flex justify-between items-center">
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(notification.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </div>
                      {activityId && (
                        <Button 
                          variant="link" 
                          size="sm" 
                          className="h-auto p-0 text-xs text-primary"
                        >
                          Ver Pedido #{activityId}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}