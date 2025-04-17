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
  const { toast } = useToast();
  const { user, logout } = useAuth();
  
  // Estados para os modais
  const [selectedActivity, setSelectedActivity] = useState<ActivityType | null>(null);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const queryClient = useQueryClient();
  
  // Verificar se o usuário é admin e redirecionar se não for
  useEffect(() => {
    if (user && user.role !== 'admin') {
      toast({
        title: "Acesso restrito",
        description: "Você não tem permissão para acessar esta página",
        variant: "destructive"
      });
      navigate(`/department/${user.role}/dashboard`);
    }
  }, [user, navigate, toast]);

  // Função para atualizar dados
  const handleRefresh = () => {
    // Invalidar consultas antigas
    queryClient.invalidateQueries({ queryKey: ["/api/activities"] });
    queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
    queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    queryClient.invalidateQueries({ queryKey: ["/api/stats/department-counts"] });
    
    // Invalidar consultas da nova API ultra-otimizada
    queryClient.invalidateQueries({ queryKey: ["/api/admin-dashboard/activities"] });
    queryClient.invalidateQueries({ queryKey: ["/api/admin-dashboard/department-stats"] });
    
    toast({
      title: "Atualizado",
      description: "Dados atualizados com sucesso",
    });
  };

  // Função para logout
  const handleLogout = () => {
    try {
      logout().then(() => {
        navigate("/auth");
      }).catch(error => {
        console.error("Erro ao fazer logout:", error);
      });
    } catch (error) {
      console.error("Erro ao fazer logout:", error);
    }
  };
  
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
          queryClient.invalidateQueries({ queryKey: ["/api/activities"] });
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

  return (
    <Layout title="Dashboard do Administrador">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">Dashboard Administrativo</h1>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleRefresh}
            className="flex items-center gap-1"
          >
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </Button>
          <Button
            variant="outline"
            onClick={handleLogout}
            className="flex items-center gap-1"
          >
            Sair
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        {/* Seção combinada: Visão Geral do Sistema */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Visão Geral</h2>
          <StatsAndDepartmentsOverview />
        </div>
        
        {/* Layout invertido - Pedidos concluídos em cima */}
        <div className="space-y-8 mt-8">
          {/* Pedidos concluídos */}
          <div>
            <OptimizedActivitiesList showCompleted={true} />
          </div>
          
          {/* Separador visual */}
          <div className="relative my-10">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white dark:bg-gray-900 px-4 text-sm text-muted-foreground">
                Pedidos em produção
              </span>
            </div>
          </div>
          
          {/* Pedidos em produção - VERSÃO NOVA SUPER SIMPLIFICADA */}
          <div>
            <Card className="w-full">
              <CardHeader className="pb-3 pt-5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle className="text-xl flex items-center">
                      <Layers className="h-5 w-5 mr-2 text-primary" />
                      Pedidos em Produção
                    </CardTitle>
                    <CardDescription>
                      Lista de pedidos atualmente em produção
                    </CardDescription>
                  </div>
                  <Button 
                    onClick={() => {
                      queryClient.invalidateQueries({ queryKey: ["/api/admin-dashboard/activities"]});
                      toast({
                        title: "Atualizando dados",
                        description: "Dados dos pedidos em produção estão sendo atualizados.",
                        variant: "default",
                      });
                    }}
                    variant="outline" 
                    size="sm" 
                    className="h-8 px-2"
                  >
                    <RefreshCw className="h-3.5 w-3.5 mr-1" />
                    Atualizar
                  </Button>
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
    },
    staleTime: 30000, // 30 segundos
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
          queryClient.invalidateQueries({ queryKey: ["/api/activities"] });
          queryClient.invalidateQueries({ queryKey: ["/api/admin-dashboard/activities"] });
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
  
  // Verificar se um prazo está próximo ou vencido
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
      />
    </div>
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

// Novo componente otimizado para listar atividades
function OptimizedActivitiesList({ showCompleted }: { showCompleted: boolean }): React.ReactNode {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedActivity, setSelectedActivity] = useState<ActivityType | null>(null);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  
  // Estado para paginação
  const [page, setPage] = useState(1);
  
  // Pré-carregamento direto para pedidos em produção (ULTRA RÁPIDO)
  useEffect(() => {
    // Aplicar o pré-carregamento apenas para pedidos em produção
    if (!showCompleted) {
      const loadProductionActivities = async () => {
        console.log("[ULTRA-RÁPIDO] Pré-carregando pedidos em produção...");
        try {
          // Construir URL otimizada
          const url = new URL("/api/admin-dashboard/activities", window.location.origin);
          url.searchParams.append("status", "producao");
          url.searchParams.append("page", page.toString());
          url.searchParams.append("limit", "30");
          url.searchParams.append("_t", Date.now().toString()); // Cache busting
          
          if (searchQuery) {
            url.searchParams.append("search", searchQuery);
          }
          
          console.log("[ULTRA-RÁPIDO] Pré-carregando pedidos em produção...");
          
          // Fetch com timeout curto
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 segundos apenas
          
          const response = await fetch(url.toString(), {
            signal: controller.signal,
            headers: {
              'Cache-Control': 'no-cache',
              'Pragma': 'no-cache'
            }
          });
          
          clearTimeout(timeoutId);
          
          if (response.ok) {
            const data = await response.json();
            // Atualizar o cache manualmente para disponibilidade imediata
            queryClient.setQueryData(
              ["/api/admin-dashboard/activities", "producao", page, searchQuery], 
              data
            );
            console.log(`[ULTRA-RÁPIDO] Pré-carregados ${data?.items?.length || 0} pedidos em produção`);
          }
        } catch (error) {
          console.error("[ULTRA-RÁPIDO] Erro no pré-carregamento:", error);
          // Erros silenciosos para não atrapalhar o fluxo principal
        }
      };
      
      // Executar imediatamente
      loadProductionActivities();
    }
  }, [showCompleted, page, searchQuery, queryClient]);

  // ULTRA OTIMIZAÇÃO APRIMORADA: Usando a nova API especializada para o admin
  // com foco em velocidade, estabilidade e resiliência
  // Referência para manter o estado antigo enquanto carrega
  const activitiesCache = useRef<any>(null);
  const cacheKey = !showCompleted ? 'production_activities_cache' : 'completed_activities_cache';

  // Armazenar localmente os dados para acesso imediato durante recargas
  useEffect(() => {
    // Carregar dados iniciais do localStorage se disponíveis
    try {
      if (!activitiesCache.current) {
        const storedData = localStorage.getItem(cacheKey);
        if (storedData) {
          const parsedData = JSON.parse(storedData);
          activitiesCache.current = parsedData;
          console.log(`[CACHE-ULTRA] Carregados ${parsedData?.items?.length || 0} pedidos do cache local`);
        }
      }
    } catch (err) {
      console.error('[CACHE-ULTRA] Erro ao carregar cache:', err);
    }
    
    if (!showCompleted) {
      try {
        const cachedData = localStorage.getItem('activities_production_cache');
        if (cachedData) {
          const parsed = JSON.parse(cachedData);
          // Verificar se o cache não é muito antigo (< 10 minutos)
          const cacheTime = localStorage.getItem('activities_production_cache_time');
          const isValidCache = cacheTime && (Date.now() - parseInt(cacheTime)) < 10 * 60 * 1000;
          
          if (isValidCache && parsed?.items?.length > 0) {
            console.log(`[CACHE-ULTRA] Usando cache local com ${parsed.items.length} pedidos para exibição instantânea`);
            activitiesCache.current = parsed;
            // Pré-carregar o cache do TanStack Query para exibição imediata
            queryClient.setQueryData(
              ["/api/admin-dashboard/activities", "producao", page, searchQuery], 
              parsed
            );
          }
        }
      } catch (e) {
        console.error("[CACHE-ULTRA] Erro ao carregar cache:", e);
      }
    }
  }, [showCompleted, queryClient, page, searchQuery]);

  // Monitorar o status do carregamento (para mostrar feedback visual)
  const [loadingState, setLoadingState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  
  // Manter um contador de tentativas de carregamento para aumentar a resiliência
  const retryCountRef = useRef(0);
  
  const { data: activitiesResponse, isLoading } = useQuery({
    queryKey: ["/api/admin-dashboard/activities", showCompleted ? 'concluido' : 'producao', page, searchQuery],
    queryFn: async () => {
      try {
        setLoadingState('loading');
        console.log(`Buscando pedidos ${showCompleted ? 'concluídos' : 'em produção'}, página ${page}`);
        
        // Construir URL com parâmetros de paginação e filtro usando a nova API otimizada
        const url = new URL("/api/admin-dashboard/activities", window.location.origin);
        
        // Definir o tipo de pedidos que queremos (concluídos ou em produção)
        url.searchParams.append("status", showCompleted ? 'concluido' : 'producao');
        
        // Parâmetros de paginação
        url.searchParams.append("page", page.toString());
        url.searchParams.append("limit", "30");
        
        // Adicionar termo de busca se existir
        if (searchQuery) {
          url.searchParams.append("search", searchQuery);
        }
        
        // Para pedidos em produção, usar cache-busting para garantir dados frescos
        url.searchParams.append("_t", Date.now().toString());
        
        // Timeout mais curto para evitar esperas muito longas
        const controller = new AbortController();
        
        // Reduzir ainda mais o timeout para pedidos em produção
        const timeoutMs = showCompleted ? 8000 : 5000; // 5s para produção, 8s para concluídos
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        
        // Headers para evitar cache do navegador
        const fetchOptions: RequestInit = {
          signal: controller.signal,
          headers: {
            'Cache-Control': 'no-cache, no-store',
            'Pragma': 'no-cache'
          }
        };
        
        // Adicionar um curto atraso antes da primeira requisição para dar tempo
        // de outras requisições mais cruciais terminarem primeiro (apenas na primeira carga)
        if (retryCountRef.current === 0 && !showCompleted) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
        
        const response = await fetch(url.toString(), fetchOptions);
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`Erro ao buscar atividades: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log(`Recebidos ${data?.items?.length || 0} pedidos ${showCompleted ? 'concluídos' : 'em produção'}`);
        
        // Resetar contador de tentativas após sucesso
        retryCountRef.current = 0;
        
        // Guardar no cache local para ter um fallback sempre disponível
        activitiesCache.current = data;
        setLoadingState('success');
        
        // Salvar no localStorage para carregamentos futuros (apenas para pedidos em produção)
        if (!showCompleted && data?.items?.length > 0) {
          try {
            localStorage.setItem('activities_production_cache', JSON.stringify(data));
            localStorage.setItem('activities_production_cache_time', Date.now().toString());
          } catch (e) {
            console.error("[CACHE-ULTRA] Erro ao salvar cache:", e);
          }
        }
        
        return data;
      } catch (error) {
        console.error("Erro na busca de pedidos:", error);
        setLoadingState('error');
        
        // Incrementar contador de tentativas
        retryCountRef.current++;
        
        // ESTRATÉGIA DE SUPER-RESILIÊNCIA
        // Em caso de erro, usar o cache local como fallback (não dispara erro)
        if (activitiesCache.current) {
          console.log(`Usando cache local como fallback devido a erro (tentativa ${retryCountRef.current})`);
          return activitiesCache.current;
        }
        
        // Se não tem cache local e os pedidos são em produção (mais críticos), gerar um objeto vazio válido
        // para não quebrar a UI e possibilitar nova tentativa automática de carregamento
        if (!showCompleted) {
          console.log("Sem cache disponível. Criando estrutura em branco para tentar novamente.");
          return { 
            items: [], 
            total: 0,
            page: 1,
            totalPages: 1
          };
        }
        
        throw error;
      }
    },
    staleTime: showCompleted ? 30000 : 8000, // Tempo mais curto para pedidos em produção
    retry: 2, // Mais tentativas para garantir carregamento
    retryDelay: attempt => Math.min(1000 * 2 ** attempt, 10000), // Exponential backoff com máximo de 10s
    refetchOnWindowFocus: !showCompleted, // Recarregar quando a janela ganha foco (apenas para pedidos em produção)
    refetchInterval: showCompleted ? false : 15000, // Recarrega a cada 15s (apenas para pedidos em produção)
    placeholderData: (prev) => prev, // Mantém dados anteriores enquanto carrega novos
    // Definir InitialData para garantir que algo seja exibido imediatamente
    initialData: () => {
      if (activitiesCache.current) {
        console.log("[ULTRA-INITIAL] Usando cache existente como dados iniciais");
        return activitiesCache.current;
      }
      return undefined;
    }
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
          queryClient.invalidateQueries({ queryKey: ["/api/activities"] });
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
  const getPriorityClass = (deadline: string | null) => {
    if (!deadline) return "";
    
    const today = new Date();
    const deadlineDate = new Date(deadline);
    const diffDays = Math.ceil((deadlineDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return "text-white bg-red-500 font-medium"; // Vencido - vermelho
    if (diffDays <= 2) return "text-white bg-amber-500 font-medium"; // Próximo - amarelo
    return "text-white bg-green-500 font-medium"; // Normal - verde
  };

  // Filtragem de atividades apenas por texto de busca (performance melhorada)
  const filteredActivities = useMemo(() => {
    if (!activities) return [];
    
    if (!searchQuery.trim()) return activities;
    
    const searchLower = searchQuery.toLowerCase();
    
    return activities.filter((activity: any) => {
      return (activity.title && activity.title.toLowerCase().includes(searchLower)) ||
             (activity.id && activity.id.toString().includes(searchQuery)) ||
             (activity.client && activity.client.toLowerCase().includes(searchLower));
    });
  }, [activities, searchQuery]);
  
  // Componente para paginação simplificada
  const Pagination = () => {
    if (totalPages <= 1) return null;
    
    return (
      <div className="flex justify-center gap-2 mt-6">
        <Button 
          variant="outline" 
          size="sm" 
          disabled={page === 1}
          onClick={() => setPage(p => Math.max(1, p - 1))}
        >
          Anterior
        </Button>
        <div className="flex items-center gap-1">
          {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
            // Se temos mais de 5 páginas, mostramos de forma inteligente
            let pageNum = i + 1;
            if (totalPages > 5) {
              if (page > 3 && page < totalPages - 1) {
                // Estamos no meio
                pageNum = page - 2 + i;
                if (i === 0) return <span key="start">1...</span>;
                if (i === 4) return <span key="end">...{totalPages}</span>;
              } else if (page >= totalPages - 1) {
                // Estamos no final
                pageNum = totalPages - 4 + i;
                if (i === 0) return <span key="start">1...</span>;
              } else {
                // Estamos no início
                if (i === 4) return <span key="end">...{totalPages}</span>;
              }
            }
            
            return (
              <Button 
                key={pageNum}
                variant={page === pageNum ? "default" : "outline"}
                size="sm"
                className="w-8 h-8 p-0"
                onClick={() => setPage(pageNum)}
              >
                {pageNum}
              </Button>
            );
          })}
        </div>
        <Button 
          variant="outline" 
          size="sm"
          disabled={page === totalPages}
          onClick={() => setPage(p => Math.min(totalPages, p + 1))}
        >
          Próxima
        </Button>
      </div>
    );
  };

  return (
    <>
      <div className="bg-white dark:bg-gray-900 p-6 rounded-lg shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold flex items-center">
            {showCompleted ? (
              <>
                <CheckCircle2 className="mr-2 h-5 w-5 text-green-500" />
                Pedidos Concluídos
              </>
            ) : (
              <>
                <Clock className="mr-2 h-5 w-5 text-amber-500" />
                Pedidos em Produção
              </>
            )}
          </h2>
          {!showCompleted && (
            <Button 
              onClick={() => setCreateModalOpen(true)}
              className="bg-gray-900 text-white dark:bg-primary"
            >
              Novo Pedido
            </Button>
          )}
        </div>
        
        {/* Barra de pesquisa */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <Input
              type="search"
              placeholder="Buscar por título, cliente ou código..."
              className="pl-10 border rounded-md w-full"
              value={searchQuery}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="flex flex-col items-center">
              <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full mb-2"></div>
              <p className="text-sm text-muted-foreground">{loadingState === 'error' ? 'Tentando reconectar...' : 'Carregando...'}</p>
            </div>
          </div>
        ) : !filteredActivities || filteredActivities.length === 0 ? (
          <div className="text-center py-8">
            {loadingState === 'error' ? (
              <div className="flex flex-col items-center">
                <AlertCircle className="h-6 w-6 text-orange-500 mb-2" />
                <p className="text-muted-foreground mb-2">
                  {!showCompleted ? "Ocorreu um erro temporário ao carregar pedidos em produção." : "Ocorreu um erro ao carregar pedidos concluídos."}
                </p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/admin-dashboard/activities"] })}
                  className="mt-2"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Tentar novamente
                </Button>
              </div>
            ) : (
              <div className="text-muted-foreground">
                {searchQuery ? 
                  "Nenhum pedido encontrado com os filtros aplicados." : 
                  showCompleted ? "Nenhum pedido concluído." : "Nenhum pedido em produção."}
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800 text-left">
                  <th className="px-4 py-3 font-medium text-sm">Título</th>
                  <th className="px-4 py-3 font-medium text-sm">Cliente</th>
                  <th className="px-4 py-3 font-medium text-sm">Setor Atual</th>
                  <th className="px-4 py-3 font-medium text-sm">Data de Entrega</th>
                  <th className="px-4 py-3 font-medium text-sm text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredActivities.map((activity: any) => {
                  // Busca o departamento atual da atividade
                  const currentDept = activity.currentDepartment || 'gabarito'; 
                  
                  return (
                  <tr key={activity.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-4 py-3">
                      <div className="font-medium">{activity.title}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{activity.client}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className={`px-3 py-1 text-center text-white rounded-md text-sm ${
                        currentDept === 'gabarito' ? 'bg-blue-600' : 
                        currentDept === 'impressao' ? 'bg-violet-600' : 
                        currentDept === 'batida' ? 'bg-amber-600' : 
                        currentDept === 'costura' ? 'bg-emerald-600' : 
                        currentDept === 'embalagem' ? 'bg-slate-600' : 
                        currentDept === 'concluido' ? 'bg-green-600' : 'bg-gray-600'
                      }`}>
                        {currentDept === 'gabarito' ? 'Gabarito' : 
                         currentDept === 'impressao' ? 'Impressão' : 
                         currentDept === 'batida' ? 'Batida' : 
                         currentDept === 'costura' ? 'Costura' : 
                         currentDept === 'embalagem' ? 'Embalagem' : 
                         currentDept === 'concluido' ? 'Concluído' : 'Pendente'}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {activity.deadline ? (
                        <div className={`font-medium ${
                          new Date(activity.deadline) < new Date() ? 'text-red-600' : 
                          new Date(activity.deadline) < new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) ? 'text-amber-600' : 
                          'text-green-600'
                        }`}>
                          {new Date(activity.deadline).toLocaleDateString('pt-BR')}
                        </div>
                      ) : (
                        <div className="text-muted-foreground">Não definida</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleView(activity as ActivityType)}
                          title="Visualizar"
                          className="h-8 w-8"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {!showCompleted && (
                          <>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => handleEdit(activity as ActivityType)}
                              title="Editar"
                              className="h-8 w-8"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => handleDelete(activity.id)}
                              title="Excluir"
                              className="h-8 w-8 text-red-500 hover:text-red-700"
                            >
                              <Trash className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
            
            {/* Paginação */}
            <Pagination />
          </div>
        )}
      </div>
      
      {/* Modais */}
      <ViewActivityModal
        isOpen={viewModalOpen}
        onClose={() => setViewModalOpen(false)}
        activity={selectedActivity}
      />
      
      <EditActivityModal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        onSuccess={() => {
          setEditModalOpen(false);
          queryClient.invalidateQueries({ queryKey: ["/api/activities"] });
          toast({
            title: "Sucesso",
            description: "Pedido atualizado com sucesso",
          });
        }}
        activity={selectedActivity}
      />
      
      <CreateActivityModal 
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSuccess={() => {
          setCreateModalOpen(false);
          queryClient.invalidateQueries({ queryKey: ["/api/activities"] });
          toast({
            title: "Sucesso",
            description: "Pedido criado com sucesso",
          });
        }}
      />
    </>
  );
}

// Componente original para listar atividades (em produção ou concluídas) - mantido para compatibilidade
function OriginalActivitiesList(showCompleted: boolean = false) {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedActivity, setSelectedActivity] = useState<ActivityType | null>(null);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  
  // Estado para paginação
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<'concluido' | 'producao' | null>(null);
  
  // Otimização: Usar staleTime mais curto e endpoint especializado para carregamento mais rápido
  const { data: activitiesResponse, isLoading, isError } = useQuery({
    queryKey: ["/api/admin-dashboard/activities", showCompleted ? 'concluido' : 'producao', page],
    queryFn: async () => {
      try {
        // Construir URL com parâmetros de paginação e filtro
        const url = new URL("/api/admin-dashboard/activities", window.location.origin);
        url.searchParams.append("status", showCompleted ? 'concluido' : 'producao');
        url.searchParams.append("page", page.toString());
        url.searchParams.append("limit", "50"); // 50 itens por página
        
        console.log(`Buscando pedidos ${showCompleted ? 'concluídos' : 'em produção'}, página ${page}`);
        
        const response = await fetch(url.toString());
        if (!response.ok) {
          throw new Error("Erro ao buscar atividades");
        }
        const data = await response.json();
        console.log(`Recebidos ${data.items.length} pedidos ${showCompleted ? 'concluídos' : 'em produção'}`);
        return data;
      } catch (error) {
        console.error("Erro na busca de pedidos:", error);
        throw error;
      }
    },
    staleTime: 15000, // 15 segundos - permite atualizações mais frequentes
    refetchOnWindowFocus: true, // Recarrega quando a janela ganha foco para manter dados atuais
    placeholderData: keepPreviousData, // Mantém dados anteriores enquanto carrega novos (UX melhor)
    refetchInterval: showCompleted ? false : 30000, // Para pedidos em produção, recarrega a cada 30 segundos
  });
  
  // Extrair dados da resposta paginada
  const activities = activitiesResponse?.items || [];
  
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
          queryClient.invalidateQueries({ queryKey: ["/api/activities"] });
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

  // Otimização: departmentOptions como constante fora do componente
  // Função para filtrar atividades - otimizada para performance
  const filterActivities = (activities: any[]) => {
    if (!activities || !Array.isArray(activities)) return [];
    
    // Otimização: Só executar filtros se necessário
    if (searchQuery === "" && !filterStatus) {
      return activities.slice(0, 100); // Limitando a 100 itens para melhorar performance
    }
    
    const searchLower = searchQuery.toLowerCase();
    
    return activities
      .filter(activity => {
        // Filtra por texto de busca - otimizado para evitar múltiplas conversões
        const matchesSearch = searchQuery === "" || 
          (activity.title && activity.title.toLowerCase().includes(searchLower)) ||
          (activity.id && activity.id.toString().includes(searchQuery)) ||
          (activity.client && activity.client.toLowerCase().includes(searchLower));
        
        // Filtra por status/departamento
        // Regra especial: se o filtro for nulo, mostra tudo
        let matchesStatus = true;
        
        if (filterStatus) {
          // Verificamos qual valor existe e está sendo usado na atividade
          // Temos duas formas diferentes dependendo de como o backend envia os dados
          const currentDept = activity.currentDepartment || activity.department || '';
          matchesStatus = currentDept === filterStatus;
        }
        
        return matchesSearch && matchesStatus;
      })
      .slice(0, 100); // Limitar a 100 itens para melhorar performance
  };

  // Verifica se um prazo está próximo ou vencido e retorna a classe de cor correspondente
  const getPriorityClass = (deadline: string | null) => {
    if (!deadline) return "";
    
    const today = new Date();
    const deadlineDate = new Date(deadline);
    const diffDays = Math.ceil((deadlineDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return "text-white bg-red-500 font-medium"; // Vencido - vermelho
    if (diffDays <= 2) return "text-white bg-amber-500 font-medium"; // Próximo - amarelo
    return "text-white bg-green-500 font-medium"; // Normal - verde
  };

  // Departamentos - constante movida para fora do componente para evitar recriação
  // Calcula a cor de fundo para o filtro ativo - simplificado
  const getFilterBgColor = (value: string | null) => 
    value === filterStatus ? "bg-primary/20" : "bg-transparent";

  // Filtra e ordena a lista de atividades - otimização com useMemo
  const filteredActivities = useMemo(() => {
    if (!activities) return [];
    
    // Primeiro filtra as atividades conforme os critérios
    let filtered = filterActivities(activities);
    
    // Filtrar por pedidos concluídos ou em produção
    filtered = filtered.filter(activity => {
      const currentDept = activity.currentDepartment || activity.department || '';
      const isCompleted = currentDept === 'concluido';
      return showCompleted ? isCompleted : !isCompleted;
    });
    
    // Depois ordena por prazo (deadline)
    return [...filtered].sort((a, b) => {
      // Se não tem prazo, fica por último
      if (!a.deadline) return 1;
      if (!b.deadline) return -1;
      
      const dateA = new Date(a.deadline);
      const dateB = new Date(b.deadline);
      
      // Ordena por prazo (os mais próximos primeiro)
      return sortOrder === "asc" 
        ? dateA.getTime() - dateB.getTime() 
        : dateB.getTime() - dateA.getTime();
    });
  }, [activities, searchQuery, filterStatus, sortOrder, showCompleted]);

  return (
    <>
      <div className="bg-white dark:bg-gray-900 p-6 rounded-lg shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold flex items-center">
            {showCompleted ? (
              <>
                <CheckCircle2 className="mr-2 h-5 w-5 text-green-500" />
                Pedidos Concluídos
              </>
            ) : (
              <>
                <Clock className="mr-2 h-5 w-5 text-amber-500" />
                Pedidos em Produção
              </>
            )}
          </h2>
          {!showCompleted && (
            <Button 
              onClick={() => setCreateModalOpen(true)}
              className="bg-gray-900 text-white dark:bg-primary"
            >
              Novo Pedido
            </Button>
          )}
        </div>
        
        {/* Barra de pesquisa */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <Input
              type="search"
              placeholder="Buscar por título, cliente ou data de entrega..."
              className="pl-10 border rounded-md w-full"
              value={searchQuery}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        
        {/* Filtro de departamentos */}
        <div className="flex flex-wrap gap-2 mb-6 hidden">
          {departmentOptions.map(option => (
            <Badge
              key={option.value || "all"}
              variant="outline"
              className={`cursor-pointer px-3 py-2 ${
                filterStatus === option.value 
                  ? 'bg-primary text-primary-foreground font-medium' 
                  : 'bg-background hover:bg-secondary'
              }`}
              onClick={() => {
                setFilterStatus(option.value);
              }}
            >
              {option.icon}
              {option.label}
            </Badge>
          ))}
        </div>
        
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full"></div>
          </div>
        ) : !filteredActivities || filteredActivities.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {searchQuery || filterStatus ? 
              "Nenhum pedido encontrado com os filtros aplicados." : 
              "Nenhum pedido encontrado no sistema."}
          </div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800 text-left">
                  <th className="px-4 py-3 font-medium text-sm">Título</th>
                  <th className="px-4 py-3 font-medium text-sm">Cliente</th>
                  <th className="px-4 py-3 font-medium text-sm">Setor Atual</th>
                  <th className="px-4 py-3 font-medium text-sm">Data de Entrega</th>
                  <th className="px-4 py-3 font-medium text-sm text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredActivities.map((activity: any) => {
                  // Busca o departamento atual da atividade
                  const currentDept = activity.currentDepartment || 'gabarito'; // valor padrão se não for encontrado
                  
                  return (
                  <tr key={activity.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-4 py-3">
                      <div className="font-medium">{activity.title}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{activity.client}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className={`px-3 py-1 text-center text-white rounded-md text-sm ${
                        currentDept === 'gabarito' ? 'bg-blue-600' : 
                        currentDept === 'impressao' ? 'bg-violet-600' : 
                        currentDept === 'batida' ? 'bg-amber-600' : 
                        currentDept === 'costura' ? 'bg-emerald-600' : 
                        currentDept === 'embalagem' ? 'bg-slate-600' : 
                        currentDept === 'concluido' ? 'bg-green-600' : 'bg-gray-600'
                      }`}>
                        {currentDept === 'gabarito' ? 'Gabarito' : 
                         currentDept === 'impressao' ? 'Impressão' : 
                         currentDept === 'batida' ? 'Batida' : 
                         currentDept === 'costura' ? 'Costura' : 
                         currentDept === 'embalagem' ? 'Embalagem' : 
                         currentDept === 'concluido' ? 'Concluído' : 'Pendente'}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {activity.deadline ? (
                        <div className={`font-medium ${
                          new Date(activity.deadline) < new Date() ? 'text-red-600' : 
                          new Date(activity.deadline) < new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) ? 'text-amber-600' : 
                          'text-green-600'
                        }`}>
                          {new Date(activity.deadline).toLocaleDateString('pt-BR')}
                        </div>
                      ) : (
                        <div className="text-muted-foreground">Não definida</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleView(activity as ActivityType)}
                          title="Visualizar"
                          className="h-8 w-8"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleEdit(activity as ActivityType)}
                          title="Editar"
                          className="h-8 w-8"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleDelete(activity.id)}
                          title="Excluir"
                          className="h-8 w-8 text-red-500 hover:text-red-700"
                        >
                          <Trash className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>
        )}
      </div>
      
      {/* Modais */}
      <ViewActivityModal
        isOpen={viewModalOpen}
        onClose={() => setViewModalOpen(false)}
        activity={selectedActivity}
      />
      
      <EditActivityModal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        onSuccess={() => {
          setEditModalOpen(false);
          queryClient.invalidateQueries({ queryKey: ["/api/activities"] });
          toast({
            title: "Sucesso",
            description: "Pedido atualizado com sucesso",
          });
        }}
        activity={selectedActivity}
      />
      
      <CreateActivityModal 
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSuccess={() => {
          setCreateModalOpen(false);
          queryClient.invalidateQueries({ queryKey: ["/api/activities"] });
          toast({
            title: "Sucesso",
            description: "Pedido criado com sucesso",
          });
        }}
      />
    </>
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
    staleTime: 60000, // 1 minuto - evita chamadas frequentes para notificações
    refetchOnWindowFocus: false // Evita recarregar quando a janela ganha foco
  });

  // Estado para controlar se o painel está expandido ou não
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Contagem de notificações não lidas
  const unreadCount = notifications?.filter((n: any) => !n.read).length || 0;

  // Formatar data para exibição
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return format(date, "dd/MM/yyyy HH:mm", { locale: ptBR });
    } catch (error) {
      return dateString;
    }
  };

  return (
    <Card>
      <CardHeader 
        className="cursor-pointer" 
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notificações
            {unreadCount > 0 && (
              <Badge variant="destructive" className="ml-2 text-xs px-2 py-0">
                {unreadCount}
              </Badge>
            )}
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-6 w-6" 
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
          >
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </CardTitle>
        <CardDescription>
          Atualizações e notificações do sistema
        </CardDescription>
      </CardHeader>
      
      {isExpanded && (
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-4">
              <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full"></div>
            </div>
          ) : !notifications || notifications.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              Nenhuma notificação encontrada.
            </div>
          ) : (
            <div className="space-y-3">
              {notifications.map((notification: any) => (
                <div 
                  key={notification.id} 
                  className={`p-3 rounded-md border ${notification.read ? 'bg-gray-50' : 'bg-blue-50 border-blue-200'}`}
                >
                  <div className="flex justify-between items-start">
                    <div className="font-medium">
                      {notification.title || "Notificação"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatDate(notification.createdAt)}
                    </div>
                  </div>
                  <p className="text-sm mt-1">{notification.message}</p>
                  {notification.activityId && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      Pedido: #{notification.activityId}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

