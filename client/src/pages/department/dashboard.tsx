import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocation, useParams } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useCallback, useEffect, useState, useRef } from "react";
import { User, Activity } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";
import { Loader2, CalendarClock, Clock, Eye, RefreshCw, RotateCcw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import Layout from "@/components/Layout";
import ViewActivityModal from "@/components/view-activity-modal";
import CompleteActivityModal from "@/components/complete-activity-modal";
import ReturnActivityModal from "@/components/return-activity-modal";
import { SoundToggleButton, SoundTestButton } from "@/components/SoundManagerSimples";

// Estendendo a interface Activity para incluir os campos que estamos recebendo do backend
interface ActivityWithNotes extends Activity {
  previousNotes?: string | null;
  previousDepartment?: string | null;
  previousCompletedBy?: string | null;
  // Campos para informações de retorno
  wasReturned?: boolean;
  returnedBy?: string | null;
  returnNotes?: string | null;
  returnedAt?: Date | null;
}

export default function DepartmentDashboard() {
  const params = useParams();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [viewActivity, setViewActivity] = useState<ActivityWithNotes | null>(null);
  const [completeActivity, setCompleteActivity] = useState<ActivityWithNotes | null>(null);
  const [returnActivity, setReturnActivity] = useState<ActivityWithNotes | null>(null);
  
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
  
  // Sempre verificar se o usuário está no dashboard correto de seu departamento
  useEffect(() => {
    if (user && user.role !== 'admin') {
      // Se o usuário não é admin e o departamento na URL não corresponde ao seu, redirecione
      if (department !== user.role) {
        console.log(`Correção de departamento: redirecionando de ${department} para ${user.role}`);
        navigate(`/department/${user.role}/dashboard`, { replace: true });
      }
    }
  }, [user, department, navigate]);

  // Sempre usar o departamento do usuário logado, ignorando o que está na URL 
  // (a menos que seja um admin, que pode visualizar qualquer departamento)
  const userDepartment = user?.role !== 'admin' ? user?.role : department;
  
  // Referência para armazenar o número atual de atividades
  const prevActivitiesCountRef = useRef(0);
  
  // Buscar atividades para o departamento do usuário
  const { data: activitiesData = [], isLoading: activitiesLoading, refetch: refetchActivities } = useQuery({
    queryKey: ["/api/department/activities", userDepartment],
    queryFn: async () => {
      if (!userDepartment || !user) return [];
      
      const response = await fetch(`/api/activities/department/${userDepartment}`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Erro ao buscar atividades do departamento');
      }
      
      return await response.json() as ActivityWithNotes[];
    },
    enabled: !!user && !!userDepartment
  });
  
  // Referência para o som de notificação
  const notificationSoundRef = useRef<HTMLAudioElement | null>(null);

  // Função para reproduzir som imediatamente - MODO DEUS!
  const playBeepSound = useCallback(() => {
    console.log("Tentando tocar som MODO DEUS...");
    
    try {
      // Criar contexto de áudio - funciona bem em dispositivos móveis
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) {
        console.error("API Web Audio não suportada neste navegador");
        return;
      }
      
      const context = new AudioContext();
      const oscillator = context.createOscillator();
      const gainNode = context.createGain();
      
      // Configurar som (beep agudo para notificação)
      oscillator.type = 'sine';
      oscillator.frequency.value = 880; // Frequência mais alta = tom mais agudo
      gainNode.gain.value = 0.3; // Volume mais baixo para não ser intrusivo
      
      // Conectar os nós de áudio
      oscillator.connect(gainNode);
      gainNode.connect(context.destination);
      
      // Iniciar oscilador e interrompê-lo após um curto período
      oscillator.start();
      
      // Tocar por apenas 300ms
      setTimeout(() => {
        oscillator.stop();
        // Fechar contexto após uso para liberar recursos
        setTimeout(() => {
          if (context.state !== 'closed') {
            context.close();
          }
        }, 100);
      }, 300);
      
      console.log("🔊 Som reproduzido com sucesso! (MODO DEUS)");
      return true;
    } catch (error) {
      console.error("Erro ao reproduzir som:", error);
      return false;
    }
  }, []);

  // Verificar se há novas atividades e tocar som se houver
  useEffect(() => {
    // Só tocamos se já tínhamos carregado antes (prevActivitiesCountRef > 0) e temos novas atividades
    if (activitiesData && activitiesData.length > prevActivitiesCountRef.current && prevActivitiesCountRef.current > 0) {
      console.log(`🔔 NOVAS ATIVIDADES DETECTADAS! Anterior: ${prevActivitiesCountRef.current}, Atual: ${activitiesData.length}`);
      
      // Tocar som imediatamente
      playBeepSound();
      
      // Mostrar notificação na tela também
      toast({
        title: "Novas atividades chegaram!",
        description: `Você tem ${activitiesData.length - prevActivitiesCountRef.current} nova(s) atividade(s) para processar.`,
        variant: "default",
      });
    }
    
    // Atualizar a contagem de atividades para a próxima comparação
    prevActivitiesCountRef.current = activitiesData?.length || 0;
  }, [activitiesData, playBeepSound, toast]);
  
  // Recarregar os dados quando o departamento do usuário mudar
  useEffect(() => {
    if (userDepartment && user) {
      refetchActivities();
    }
  }, [userDepartment, user, refetchActivities]);
  
  // Buscar estatísticas do departamento
  const { data: stats = { pendingCount: 0, completedCount: 0 }, isLoading: statsLoading, refetch: refetchStats } = useQuery({
    queryKey: ["/api/department/stats", userDepartment],
    queryFn: async () => {
      if (!userDepartment || !user) return { pendingCount: 0, completedCount: 0 };
      
      const response = await fetch(`/api/department/${userDepartment}/stats`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Erro ao buscar estatísticas do departamento');
      }
      
      return await response.json();
    },
    enabled: !!user && !!userDepartment
  });
  
  // Recarregar estatísticas quando o departamento do usuário mudar
  useEffect(() => {
    if (userDepartment && user) {
      refetchStats();
    }
  }, [userDepartment, user, refetchStats]);
  
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
  
  // Função para tratar o retorno da atividade
  const handleActivityReturned = () => {
    toast({
      title: "Pedido retornado com sucesso",
      description: "O pedido foi retornado ao setor anterior para correção.",
    });
    setReturnActivity(null);
    
    // Recarregar dados após o retorno de uma atividade
    refetchActivities();
    refetchStats();
  };

  // Função para capitalizar a primeira letra
  const capitalize = (text: string) => {
    return text.charAt(0).toUpperCase() + text.slice(1);
  };

  // Função para atualizar manualmente a página (F5)
  const handleRefresh = () => {
    // Tentar tocar um som de teste quando o usuário atualiza manualmente
    playBeepSound();
    
    // Recarregar a página completamente (como o F5)
    window.location.reload();
  };
  
  // Função para fazer logout
  const handleLogout = async () => {
    try {
      const response = await fetch('/api/logout', {
        method: 'POST',
        credentials: 'include',
      });
      
      if (response.ok) {
        toast({
          title: "Logout realizado com sucesso",
        });
        navigate("/auth");
      } else {
        throw new Error('Falha ao fazer logout');
      }
    } catch (error) {
      console.error("Erro ao fazer logout:", error);
      toast({
        title: "Falha no logout",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    }
  };

  return (
    <Layout title={`Dashboard - ${userDepartment ? capitalize(userDepartment) : 'Departamento'}`}>
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium">
            Bem-vindo, <span className="font-semibold">{user?.name || user?.username}</span>
          </h3>
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleLogout}
            className="flex items-center gap-1"
          >
            Sair
          </Button>
          
          {/* Botão de Som MODO DEUS */}
          <Button 
            variant="outline"
            size="sm"
            onClick={playBeepSound}
            className="flex items-center px-3 py-1 bg-blue-100 text-blue-800 hover:bg-blue-200 border-blue-300 animate-pulse"
          >
            <span className="mr-1">🔊</span>
            <span>Ativar Notificações Sonoras</span>
          </Button>
        </div>
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
                  {/* Ordena atividades por data de entrega */}
                  {[...activitiesData]
                    .sort((a, b) => {
                      // Se ambos têm deadline, ordena por data
                      if (a.deadline && b.deadline) {
                        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
                      }
                      // Se apenas a atividade A tem deadline, ela vem primeiro
                      else if (a.deadline) {
                        return -1;
                      }
                      // Se apenas a atividade B tem deadline, ela vem primeiro
                      else if (b.deadline) {
                        return 1;
                      }
                      // Se nenhuma tem deadline, mantém a ordem original
                      return 0;
                    })
                    .map((activity) => (
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
                            
                            {/* Informações de retorno, se o pedido foi retornado */}
                            {activity.wasReturned && (
                              <div className="bg-red-50 p-2 rounded-md mb-2 border border-red-200">
                                <p className="font-medium text-red-800 text-sm">
                                  Pedido retornado pelo próximo setor
                                </p>
                                <p className="text-sm text-red-700">
                                  <span className="font-medium">Retornado por:</span> {activity.returnedBy || "Não informado"}
                                </p>
                                {activity.returnNotes && (
                                  <p className="text-sm text-red-700">
                                    <span className="font-medium">Motivo:</span> {activity.returnNotes}
                                  </p>
                                )}
                                {activity.returnedAt && (
                                  <p className="text-xs text-red-600 mt-1">
                                    <span className="font-medium">Data:</span> {formatDate(activity.returnedAt)}
                                  </p>
                                )}
                              </div>
                            )}
                            
                            {/* Observações do setor anterior */}
                            {activity.previousNotes && !activity.wasReturned && (
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
                          
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="flex items-center text-yellow-600 hover:text-yellow-700"
                            onClick={() => setReturnActivity(activity)}
                          >
                            <RotateCcw className="h-4 w-4 mr-1" />
                            <span>Retornar</span>
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
          
          {/* Modal de retorno de atividade */}
          <ReturnActivityModal 
            isOpen={!!returnActivity}
            onClose={() => setReturnActivity(null)}
            activityId={returnActivity?.id || null}
            onSuccess={handleActivityReturned}
          />
        </>
      )}
    </Layout>
  );
}