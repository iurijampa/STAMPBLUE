import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { 
  RefreshCw, Activity, Clock, Calendar, Users, ChevronRight, 
  AlertTriangle, Layers, CheckCircle2, Bell, Eye, Edit, 
  Trash, Plus, Loader2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import Layout from "@/components/Layout";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import DepartmentActivityCounter from "@/components/department-activity-counter";
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
    queryClient.invalidateQueries({ queryKey: ["/api/activities"] });
    queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
    queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    queryClient.invalidateQueries({ queryKey: ["/api/stats/department-counts"] });
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
        {/* Visão geral - Apenas os cards de estatísticas */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Visão Geral</h2>
          <StatsOverview />
        </div>
        
        {/* Departamentos logo abaixo */}
        <div>
          <DepartmentActivityCounter />
        </div>
        
        {/* Abas para navegação */}
        <Tabs defaultValue="all-activities" className="w-full mt-8">
          <TabsList className="w-full mb-4">
            <TabsTrigger value="all-activities" className="flex-1">Todos os Pedidos</TabsTrigger>
            <TabsTrigger value="notifications" className="flex-1">Notificações</TabsTrigger>
            <TabsTrigger value="users" className="flex-1">Gerenciar Usuários</TabsTrigger>
            <TabsTrigger value="stats" className="flex-1">Estatísticas</TabsTrigger>
          </TabsList>
          
          <TabsContent value="all-activities">
            <div className="space-y-6">
              {/* Lista de todas as atividades */}
              {ActivitiesList()}
            </div>
          </TabsContent>
          
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

// Componente para visão geral das estatísticas
function StatsOverview() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["/api/stats"],
    queryFn: async () => {
      const response = await fetch("/api/stats");
      if (!response.ok) {
        throw new Error("Erro ao buscar estatísticas");
      }
      return response.json();
    }
  });

  return (
    <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Total de Pedidos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {isLoading ? "..." : stats?.total || 0}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Pedidos no sistema
          </p>
          <div className="mt-2">
            <Activity className="h-4 w-4 text-primary" />
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Em Produção
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {isLoading ? "..." : stats?.inProgress || 0}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Pedidos em processamento
          </p>
          <div className="mt-2">
            <Clock className="h-4 w-4 text-amber-500" />
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Concluídos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {isLoading ? "..." : stats?.completed || 0}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Pedidos finalizados
          </p>
          <div className="mt-2">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </div>
        </CardContent>
      </Card>
    </div>
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

// Componente para listar todas as atividades
function ActivitiesList() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedActivity, setSelectedActivity] = useState<ActivityType | null>(null);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  
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
    <>
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Todos os Pedidos</CardTitle>
              <CardDescription>
                Lista completa de pedidos no sistema
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={() => setCreateModalOpen(true)}
                className="flex items-center gap-1"
                variant="default"
              >
                <Plus className="h-4 w-4 mr-1" />
                Novo Pedido
              </Button>
              <Button 
                onClick={() => navigate("/admin/users")}
                className="flex items-center gap-1"
                variant="outline"
              >
                <Users className="h-4 w-4 mr-1" />
                Gerenciar Usuários
              </Button>
            </div>
          </div>
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
              {activities.map((activity: any) => (
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
                    <div className="flex items-center justify-between">
                      <p className="font-medium truncate">{activity.title}</p>
                      <Badge className={
                        activity.status === 'completed' ? 'bg-green-500' : 
                        activity.status === 'in_progress' ? 'bg-amber-500' : 'bg-blue-500'
                      }>
                        {activity.status === 'completed' ? 'Concluído' : 
                         activity.status === 'in_progress' ? 'Em Andamento' : 'Pendente'}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      ID: #{activity.id} • {new Date(activity.createdAt).toLocaleDateString('pt-BR')}
                      {activity.deadline && ` • Prazo: ${new Date(activity.deadline).toLocaleDateString('pt-BR')}`}
                    </p>
                  </div>
                  
                  {/* Área de ações */}
                  <div className="flex items-center gap-2">
                    {activity.priority && (
                      <div className="bg-red-100 text-red-800 px-2 py-0.5 rounded text-xs flex items-center mr-2">
                        Prioridade
                      </div>
                    )}
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => handleView(activity as ActivityType)}
                      title="Visualizar"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => handleEdit(activity as ActivityType)}
                      title="Editar"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => handleDelete(activity.id)}
                      title="Excluir"
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      
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
    }
  });

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
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Notificações
        </CardTitle>
        <CardDescription>
          Atualizações e notificações do sistema
        </CardDescription>
      </CardHeader>
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
    </Card>
  );
}