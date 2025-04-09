import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useState, useMemo } from "react";
import { Activity, User, Notification, DEPARTMENTS, ActivityProgress } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { Search } from "lucide-react";

// Interface para o retorno do endpoint de progresso das atividades
interface ActivityProgressData {
  activityId: number;
  progress: ActivityProgress[];
}
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  Loader2, 
  CircleX, 
  AlertCircle, 
  CheckCircle2, 
  Users, 
  Edit, 
  Trash2, 
  Eye,
  Bell,
  BellRing,
  Database
} from "lucide-react";
import CreateActivityModal from "@/components/create-activity-modal";
import EditActivityModal from "@/components/edit-activity-modal";
import DeleteActivityDialog from "@/components/delete-activity-dialog";
import ViewActivityModal from "@/components/view-activity-modal";
import BackupManager from "@/components/backup-manager";
import { SoundToggleButton, SoundTestButton } from "@/components/SoundManagerSimples";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminDashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Query para buscar todas as atividades
  const { 
    data: activities, 
    isLoading: activitiesLoading,
    refetch: refetchActivities
  } = useQuery<Activity[]>({
    queryKey: ['/api/activities'],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/activities");
      if (!response.ok) {
        throw new Error("Falha ao carregar atividades");
      }
      const data = await response.json();
      // Ordenar por data de entrega, com datas mais próximas primeiro
      return data.sort((a: Activity, b: Activity) => {
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      });
    },
    enabled: !isLoading && !!user,
  });
  
  // Consulta para obter progresso de todos os pedidos
  const {
    data: progressData,
    isLoading: progressLoading
  } = useQuery<ActivityProgressData[]>({
    queryKey: ['/api/activities/progress'],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/activities/progress");
      if (!response.ok) {
        throw new Error("Falha ao carregar progresso dos pedidos");
      }
      return response.json();
    },
    enabled: !isLoading && !!user,
  });

  // Dados de estatísticas
  const { 
    data: stats,
    isLoading: statsLoading,
    refetch: refetchStats 
  } = useQuery({
    queryKey: ['/api/stats'],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/stats");
      if (!response.ok) {
        throw new Error("Falha ao carregar estatísticas");
      }
      return response.json();
    },
    enabled: !isLoading && !!user,
  });
  
  // Buscar notificações
  const {
    data: notifications,
    isLoading: notificationsLoading,
    refetch: refetchNotifications
  } = useQuery<Notification[]>({
    queryKey: ['/api/notifications'],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/notifications");
      if (!response.ok) {
        throw new Error("Falha ao carregar notificações");
      }
      return response.json();
    },
    enabled: !isLoading && !!user,
  });
  
  // Marcar notificação como lida
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: number) => {
      const response = await apiRequest("POST", `/api/notifications/${notificationId}/read`);
      if (!response.ok) {
        throw new Error("Falha ao marcar notificação como lida");
      }
      return response.json();
    },
    onSuccess: () => {
      refetchNotifications();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Verificar autenticação
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/user', {
          credentials: 'include'
        });
        
        if (response.status === 401) {
          navigate("/auth");
          return;
        }
        
        if (response.ok) {
          const userData = await response.json();
          setUser(userData);
          
          // Verificar se o usuário é admin
          if (userData.role !== "admin") {
            navigate("/department/dashboard");
          }
        }
      } catch (err) {
        console.error("Erro ao verificar autenticação:", err);
      } finally {
        setIsLoading(false);
      }
    };
    
    checkAuth();
  }, [navigate]);

  // Função para fazer logout usando o hook de autenticação
  const { logout } = useAuth();
  const handleLogout = async () => {
    try {
      // Usar o método logout do hook de autenticação para garantir
      // que o estado do React seja atualizado corretamente
      await logout();
      
      // A navegação acontecerá automaticamente pelo DashboardRedirect
      // no App.tsx quando o estado de usuário for limpo
      
    } catch (error) {
      console.error("Erro ao fazer logout:", error);
      // Toast de erro já é mostrado pelo hook de autenticação
    }
  };

  const refreshData = () => {
    refetchActivities();
    refetchStats();
    refetchNotifications();
  };
  
  const handleMarkAsRead = (notificationId: number) => {
    markAsReadMutation.mutate(notificationId);
  };

  const handleEditActivity = (activity: Activity) => {
    setSelectedActivity(activity);
    setIsEditModalOpen(true);
  };

  const handleDeleteActivity = (activity: Activity) => {
    setSelectedActivity(activity);
    setIsDeleteDialogOpen(true);
  };

  const handleViewActivity = (activity: Activity) => {
    setSelectedActivity(activity);
    setIsViewModalOpen(true);
  };

  // Filtrar atividades com base no termo de pesquisa
  const filteredActivities = useMemo(() => {
    if (!activities) return [];
    if (!searchTerm.trim()) return activities;
    
    const searchTermLower = searchTerm.toLowerCase().trim();
    
    return activities.filter((activity) => {
      // Buscar por título
      const titleMatch = activity.title?.toLowerCase().includes(searchTermLower);
      
      // Buscar por cliente
      const clientMatch = activity.clientName?.toLowerCase().includes(searchTermLower);
      
      // Buscar por data de entrega
      const deadlineStr = activity.deadline 
        ? new Date(activity.deadline).toLocaleDateString('pt-BR')
        : '';
      const deadlineMatch = deadlineStr.includes(searchTermLower);
      
      return titleMatch || clientMatch || deadlineMatch;
    });
  }, [activities, searchTerm]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin mr-2" />
        <p>Carregando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8 bg-gray-50 overflow-x-hidden">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-4 md:p-6 mb-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Dashboard do Administrador</h1>
            <div className="flex items-center gap-3">
              <p className="text-sm text-muted-foreground">
                Bem-vindo, <span className="font-semibold">{user?.name || user?.username}</span>
              </p>
              <Button 
                variant="outline" 
                onClick={() => navigate("/admin/users")}
                size="sm"
                className="flex items-center gap-1"
              >
                <Users className="h-4 w-4" />
                Gerenciar Usuários
              </Button>
              <Button variant="outline" onClick={handleLogout} size="sm">
                Sair
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-8">
            <div className="bg-primary-50 rounded-lg p-4 border border-primary-200">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold mb-2">Pendentes</h2>
                <AlertCircle className="text-amber-500 h-5 w-5" />
              </div>
              <p className="text-3xl font-bold">
                {statsLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : (
                  stats?.pending || 0
                )}
              </p>
            </div>
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold mb-2">Em Progresso</h2>
                <Loader2 className="text-blue-500 h-5 w-5" />
              </div>
              <p className="text-3xl font-bold">
                {statsLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : (
                  stats?.inProgress || 0
                )}
              </p>
            </div>
            <div className="bg-green-50 rounded-lg p-4 border border-green-200">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold mb-2">Concluídas</h2>
                <CheckCircle2 className="text-green-500 h-5 w-5" />
              </div>
              <p className="text-3xl font-bold">
                {statsLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : (
                  stats?.completed || 0
                )}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-lg p-4 md:p-6 border border-border">
            <div className="flex flex-col space-y-4 mb-6">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold">Pedidos</h2>
                <Button onClick={() => setIsCreateModalOpen(true)}>
                  Novo Pedido
                </Button>
              </div>
              
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Buscar por título, cliente ou data de entrega..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-full"
                />
              </div>
            </div>
            
            {activitiesLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : !activities || activities.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed rounded-lg">
                <CircleX className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <h3 className="text-lg font-medium text-muted-foreground">Nenhum pedido encontrado</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Clique em "Novo Pedido" para criar seu primeiro pedido
                </p>
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <div className="overflow-x-auto w-full">
                  <table className="w-full text-sm min-w-[650px]">
                    <thead>
                      <tr className="bg-muted">
                        <th className="px-4 py-3 text-left font-medium">Título</th>
                        <th className="px-4 py-3 text-left font-medium">Cliente</th>
                        <th className="px-4 py-3 text-left font-medium">Setor Atual</th>
                        <th className="px-4 py-3 text-left font-medium">Entrega</th>
                        <th className="px-4 py-3 text-left font-medium">Criado em</th>
                        <th className="px-4 py-3 text-right font-medium">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {filteredActivities.length === 0 && searchTerm.trim() !== '' ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                            Nenhum pedido encontrado para: "{searchTerm}"
                          </td>
                        </tr>
                      ) : filteredActivities.map((activity) => (
                        <tr key={activity.id} className="hover:bg-muted/50">
                          <td className="px-4 py-3 truncate max-w-[150px]">{activity.title}</td>
                          <td className="px-4 py-3 truncate max-w-[100px]">{activity.clientName || "—"}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium 
                              ${activity.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                              {activity.status === 'completed' ? 
                                'Concluído' : 
                                (() => {
                                  // Obter o departamento atual com base no progresso
                                  if (progressData) {
                                    const activityProgress = progressData.find((p: {activityId: number}) => p.activityId === activity.id);
                                    if (activityProgress && activityProgress.progress.length > 0) {
                                      // Encontrar o departamento com status "pending"
                                      const pendingProgress = activityProgress.progress.find((p: ActivityProgress) => p.status === 'pending');
                                      if (pendingProgress) {
                                        // Capitalizar o nome do departamento
                                        return pendingProgress.department.charAt(0).toUpperCase() + 
                                               pendingProgress.department.slice(1);
                                      }
                                    }
                                  }
                                  return 'Em Progresso';
                                })()
                              }
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {activity.deadline ? (
                              <span className={`font-medium ${
                                new Date(activity.deadline) < new Date() ? 'text-red-500' : 
                                new Date(activity.deadline).getTime() - new Date().getTime() < 7 * 24 * 60 * 60 * 1000 ? 'text-amber-600' : 'text-green-600'
                              }`}>
                                {new Date(activity.deadline).toLocaleDateString('pt-BR')}
                              </span>
                            ) : "—"}
                          </td>
                          <td className="px-4 py-3">
                            {new Date(activity.createdAt).toLocaleDateString('pt-BR')}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end gap-1">
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => handleViewActivity(activity)}
                                title="Visualizar"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => handleEditActivity(activity)}
                                title="Editar"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => handleDeleteActivity(activity)}
                                className="text-red-500 hover:text-red-600 hover:bg-red-50"
                                title="Excluir"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Notificações de pedidos realizados */}
          <div className="bg-white rounded-lg p-4 md:p-6 border border-border mt-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold flex items-center">
                <BellRing className="mr-2 h-5 w-5 text-primary" />
                Notificações de Pedidos
              </h2>
            </div>
            
            {notificationsLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : !notifications || notifications.length === 0 ? (
              <div className="text-center py-8 border-2 border-dashed rounded-lg">
                <Bell className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                <h3 className="text-lg font-medium text-muted-foreground">Nenhuma notificação</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Os pedidos concluídos pelos setores aparecerão aqui
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {notifications.map((notification) => (
                  <Card key={notification.id} className={`overflow-hidden ${!notification.read ? 'border-l-4 border-l-primary' : ''}`}>
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <CardTitle className="text-base">{notification.message}</CardTitle>
                        {!notification.read && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-7 w-7 p-0 text-green-600 hover:text-green-700 hover:bg-green-100"
                            onClick={() => handleMarkAsRead(notification.id)}
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            <span className="sr-only">Marcar como lido</span>
                          </Button>
                        )}
                      </div>
                      <CardDescription>
                        {new Date(notification.createdAt).toLocaleString('pt-BR')}
                      </CardDescription>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Sistema de backup (expansível) */}
          <div className="mt-6">
            <BackupManager />
          </div>
          
          {/* Sistema de teste de sons */}
          <div>
            <div className="flex gap-2 items-center justify-center">
              <SoundToggleButton />
              <SoundTestButton />
            </div>
          </div>
        </div>
      </div>

      {/* Modais */}
      <CreateActivityModal 
        isOpen={isCreateModalOpen} 
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={refreshData}
      />
      
      <EditActivityModal 
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedActivity(null);
        }}
        onSuccess={refreshData}
        activity={selectedActivity}
      />
      
      <DeleteActivityDialog 
        isOpen={isDeleteDialogOpen}
        onClose={() => {
          setIsDeleteDialogOpen(false);
          setSelectedActivity(null);
        }}
        onSuccess={refreshData}
        activityId={selectedActivity?.id || null}
        activityTitle={selectedActivity?.title || ""}
      />

      <ViewActivityModal 
        isOpen={isViewModalOpen}
        onClose={() => {
          setIsViewModalOpen(false);
          setSelectedActivity(null);
        }}
        activity={selectedActivity}
      />
    </div>
  );
}