import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { RefreshCw, Activity, Clock, Calendar, Users, ChevronRight, AlertTriangle, Layers, CheckCircle2, Bell } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import Layout from "@/components/Layout";
import { useQuery } from "@tanstack/react-query";
import DepartmentActivityCounter from "@/components/department-activity-counter";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";

export default function AdminDashboard() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user, logout } = useAuth();
  
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
    // Refresh all queries
    window.location.reload();
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
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="w-full mb-4">
            <TabsTrigger value="overview" className="flex-1">Visão Geral</TabsTrigger>
            <TabsTrigger value="all-activities" className="flex-1">Todos os Pedidos</TabsTrigger>
            <TabsTrigger value="department-counts" className="flex-1">Atividades por Departamento</TabsTrigger>
            <TabsTrigger value="notifications" className="flex-1">Notificações</TabsTrigger>
            <TabsTrigger value="stats" className="flex-1">Estatísticas</TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview">
            <div className="space-y-6">
              {/* Estatísticas gerais do sistema */}
              <StatsOverview />
              
              {/* Lista de atividades recentes */}
              <RecentActivities />
            </div>
          </TabsContent>
          
          <TabsContent value="all-activities">
            <div className="space-y-6">
              <ActivitiesList />
            </div>
          </TabsContent>
          
          <TabsContent value="department-counts">
            <DepartmentActivityCounter />
          </TabsContent>
          
          <TabsContent value="notifications">
            <div className="space-y-6">
              <NotificationsList />
            </div>
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
        <CardTitle>Todos os Pedidos</CardTitle>
        <CardDescription>
          Lista completa de pedidos no sistema
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
                {activity.priority && (
                  <div className="bg-red-100 text-red-800 px-2 py-0.5 rounded text-xs">
                    Prioridade
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