import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocation, useParams } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import { User, Activity } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";
import { Loader2, CalendarClock, Clock, Eye, RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import Layout from "@/components/Layout";
import ViewActivityModal from "@/components/view-activity-modal";
import CompleteActivityModal from "@/components/complete-activity-modal";

// Estendendo a interface Activity para incluir os campos que estamos recebendo do backend
interface ActivityWithNotes extends Activity {
  previousNotes?: string | null;
  previousDepartment?: string | null;
  previousCompletedBy?: string | null;
}

export default function DepartmentDashboard() {
  const params = useParams();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [viewActivity, setViewActivity] = useState<ActivityWithNotes | null>(null);
  const [completeActivity, setCompleteActivity] = useState<ActivityWithNotes | null>(null);
  
  // Obtendo o departamento da URL
  const department = params.department;
  
  // Buscar dados do usuário autenticado
  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ["/api/user"],
    queryFn: async () => {
      const response = await fetch('/api/user', {
        credentials: 'include'
      });
      
      if (response.status === 401) {
        navigate("/auth");
        return null;
      }
      
      if (!response.ok) {
        throw new Error('Erro ao buscar dados do usuário');
      }
      
      const userData = await response.json();
      
      // Verificar se o usuário é admin
      if (userData.role === "admin") {
        navigate("/admin/dashboard");
      }
      
      return userData as User;
    }
  });
  
  // Verificar se o usuário tem permissão para acessar este departamento
  useEffect(() => {
    if (user && department && user.role !== department && user.role !== 'admin') {
      toast({
        title: "Acesso negado",
        description: "Você não tem permissão para acessar este departamento",
        variant: "destructive"
      });
      navigate(`/department/${user.role}/dashboard`);
    }
  }, [user, department, navigate, toast]);

  // Buscar atividades para o departamento da URL
  const { data: activitiesData = [], isLoading: activitiesLoading, refetch: refetchActivities } = useQuery({
    queryKey: ["/api/department/activities", department],
    queryFn: async () => {
      if (!department || !user) return [];
      
      const response = await fetch(`/api/activities/department/${department}`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Erro ao buscar atividades do departamento');
      }
      
      return await response.json() as ActivityWithNotes[];
    },
    enabled: !!user && !!department
  });
  
  // Recarregar os dados quando o departamento mudar
  useEffect(() => {
    if (department && user) {
      refetchActivities();
    }
  }, [department, user, refetchActivities]);
  
  // Buscar estatísticas do departamento
  const { data: stats = { pendingCount: 0, completedCount: 0 }, isLoading: statsLoading, refetch: refetchStats } = useQuery({
    queryKey: ["/api/department/stats", department],
    queryFn: async () => {
      if (!department || !user) return { pendingCount: 0, completedCount: 0 };
      
      const response = await fetch(`/api/department/${department}/stats`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Erro ao buscar estatísticas do departamento');
      }
      
      return await response.json();
    },
    enabled: !!user && !!department
  });
  
  // Recarregar estatísticas quando o departamento mudar
  useEffect(() => {
    if (department && user) {
      refetchStats();
    }
  }, [department, user, refetchStats]);
  
  // Função para formatar a data
  const formatDate = (date: Date | null) => {
    if (!date) return "Sem data";
    return new Date(date).toLocaleDateString('pt-BR');
  };
  
  // Função para obter a cor conforme o prazo
  const getDeadlineColor = (deadline: Date | null) => {
    if (!deadline) return "bg-gray-500";
    
    const today = new Date();
    const deadlineDate = new Date(deadline);
    const diffTime = deadlineDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return "bg-red-500"; // Atrasado
    if (diffDays <= 2) return "bg-yellow-500"; // Próximo do prazo
    return "bg-green-500"; // Dentro do prazo
  };
  
  // Função para tratar a conclusão da atividade
  const handleActivityCompleted = () => {
    toast({
      title: "Atividade concluída com sucesso",
      description: "A atividade foi marcada como concluída e enviada para o próximo setor.",
    });
    setCompleteActivity(null);
    
    // Recarregar dados após a conclusão de uma atividade
    refetchActivities();
    refetchStats();
  };

  // Função para capitalizar a primeira letra
  const capitalize = (text: string) => {
    return text.charAt(0).toUpperCase() + text.slice(1);
  };

  // Função para atualizar manualmente todos os dados
  const handleRefresh = () => {
    refetchActivities();
    refetchStats();
    toast({
      title: "Dados atualizados",
      description: "Os dados foram atualizados com sucesso",
    });
  };

  return (
    <Layout title={`Dashboard - ${department ? capitalize(department) : 'Departamento'}`}>
      <div className="flex justify-end mb-4">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleRefresh}
          className="flex items-center gap-1"
          disabled={userLoading || activitiesLoading}
        >
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            width="16" 
            height="16" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            className="h-4 w-4"
          >
            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
            <path d="M21 3v5h-5" />
            <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
            <path d="M8 16H3v5" />
          </svg>
          <span>Atualizar</span>
        </Button>
      </div>
      
      {userLoading || activitiesLoading ? (
        <div className="h-64 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-semibold">Atividades Pendentes</CardTitle>
                <CardDescription>Atividades aguardando seu departamento</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{stats.pendingCount || 0}</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-semibold">Atividades Concluídas</CardTitle>
                <CardDescription>Atividades finalizadas pelo seu departamento</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{stats.completedCount || 0}</p>
              </CardContent>
            </Card>
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle>Atividades Pendentes</CardTitle>
              <CardDescription>
                Lista de atividades que precisam ser processadas pelo seu departamento
              </CardDescription>
            </CardHeader>
            <CardContent>
              {activitiesData && activitiesData.length > 0 ? (
                <div className="space-y-4">
                  {activitiesData.map((activity) => (
                    <div 
                      key={activity.id}
                      className="border rounded-lg p-4 hover:bg-neutral-50 transition-colors"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex gap-4">
                          {/* Miniatura da imagem */}
                          <div className="w-16 h-16 min-w-16 rounded overflow-hidden border bg-neutral-100 flex items-center justify-center">
                            {activity.image ? (
                              <img 
                                src={activity.image} 
                                alt={`Imagem de ${activity.title}`} 
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className="text-xs text-neutral-400">Sem imagem</span>
                            )}
                          </div>
                          
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <Badge 
                                variant="outline" 
                                className={cn("text-white", getDeadlineColor(activity.deadline))}
                              >
                                {activity.deadline ? formatDate(activity.deadline) : "Sem prazo"}
                              </Badge>
                            </div>
                            
                            <h3 className="text-lg font-semibold">{activity.title}</h3>
                            <p className="text-neutral-600 line-clamp-2 my-2">
                              {activity.description}
                            </p>
                            
                            {/* Observações do setor anterior */}
                            {activity.previousNotes && (
                              <div className="bg-amber-50 p-2 rounded-md mb-2 border border-amber-200">
                                <p className="font-medium text-amber-800 text-sm">
                                  Observações do setor anterior ({activity.previousDepartment}):
                                </p>
                                <p className="text-sm text-amber-700">
                                  {activity.previousNotes}
                                </p>
                                {activity.previousCompletedBy && (
                                  <p className="text-xs text-amber-600 mt-1">
                                    Finalizado por: {activity.previousCompletedBy}
                                  </p>
                                )}
                              </div>
                            )}
                            
                            <div className="flex items-center text-sm text-neutral-500 gap-4 mt-2">
                              <div className="flex items-center">
                                <CalendarClock className="h-4 w-4 mr-1" />
                                <span>Criado: {formatDate(activity.createdAt)}</span>
                              </div>
                              
                              {activity.deadline && (
                                <div className="flex items-center">
                                  <Clock className="h-4 w-4 mr-1" />
                                  <span>
                                    Entrega em {formatDistanceToNow(new Date(activity.deadline), {
                                      addSuffix: true, 
                                      locale: ptBR
                                    })}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex flex-col gap-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="flex items-center"
                            onClick={() => setViewActivity(activity)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            <span>Visualizar</span>
                          </Button>
                          
                          <Button 
                            variant="default" 
                            size="sm"
                            onClick={() => setCompleteActivity(activity)}
                          >
                            Concluir
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-neutral-500">
                  Nenhuma atividade pendente encontrada para o seu departamento.
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Modal de visualização de atividade */}
          <ViewActivityModal 
            isOpen={!!viewActivity}
            onClose={() => setViewActivity(null)}
            activity={viewActivity}
          />
          
          {/* Modal de conclusão de atividade */}
          <CompleteActivityModal 
            isOpen={!!completeActivity}
            onClose={() => setCompleteActivity(null)}
            activityId={completeActivity?.id || null}
            onSuccess={handleActivityCompleted}
          />
        </>
      )}
    </Layout>
  );
}