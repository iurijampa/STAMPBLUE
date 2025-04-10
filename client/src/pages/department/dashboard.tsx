import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocation, useParams } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useCallback, useEffect, useState, useRef } from "react";
import { User, Activity } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";
import { Loader2, CalendarClock, Clock, Eye, RefreshCw, RotateCcw, Printer } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Layout from "@/components/Layout";
import ViewActivityModal from "@/components/view-activity-modal";
import CompleteActivityModal from "@/components/complete-activity-modal";
import ReturnActivityModal from "@/components/return-activity-modal";
import ReprintRequestModal from "@/components/reprint-request-modal";
import ReprintRequestsList from "@/components/reprint-requests-list";
import { ActivitySkeleton, StatsSkeleton } from "@/components/activity-skeleton";
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
  const [reprintActivity, setReprintActivity] = useState<ActivityWithNotes | null>(null);
  const [activeTab, setActiveTab] = useState<string>("pendingActivities");
  
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
    if (user) {
      // Se o usuário é admin, ele não deveria estar aqui
      if (user.role === 'admin') {
        console.log('Usuário admin detectado no dashboard de departamento. Redirecionando para o admin dashboard.');
        navigate('/admin/dashboard', { replace: true });
        return;
      }
      
      // Se o usuário não é admin e o departamento na URL não corresponde ao seu, redirecione
      if (department !== user.role) {
        console.log(`Correção de departamento: redirecionando de ${department} para ${user.role}`);
        navigate(`/department/${user.role}/dashboard`, { replace: true });
        return;
      }
      
      console.log(`Usuário ${user.username} (${user.role}) verificado no dashboard correto: ${department}`);
    }
  }, [user, department, navigate]);

  // Sempre usar o departamento do usuário logado, ignorando o que está na URL 
  // (a menos que seja um admin, que pode visualizar qualquer departamento)
  const userDepartment = user?.role !== 'admin' ? user?.role : department;
  
  // Referência para armazenar o número atual de atividades
  const prevActivitiesCountRef = useRef(0);
  
  // Buscar atividades para o departamento do usuário - OTIMIZADO
  const { data: activitiesData = [], isLoading: activitiesLoading, refetch: refetchActivities } = useQuery({
    queryKey: ["/api/department/activities", userDepartment],
    queryFn: async () => {
      if (!userDepartment || !user) return [];
      
      console.log(`Buscando atividades para ${userDepartment}...`);
      const startTime = performance.now();
      
      try {
        const response = await fetch(`/api/activities/department/${userDepartment}`, {
          credentials: 'include',
          // Adicionar cabeçalho para evitar cache do navegador
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });
        
        if (!response.ok) {
          throw new Error('Erro ao buscar atividades do departamento');
        }
        
        const data = await response.json() as ActivityWithNotes[];
        const endTime = performance.now();
        console.log(`Atividades carregadas em ${(endTime - startTime).toFixed(2)}ms. Total: ${data.length}`);
        
        return data;
      } catch (error) {
        console.error("Falha ao carregar atividades:", error);
        throw error;
      }
    },
    enabled: !!user && !!userDepartment,
    staleTime: 30000, // Manter dados em cache por 30 segundos
    refetchOnWindowFocus: false // Evitar refetch ao focar a janela
  });
  
  // Referência para o som de notificação
  const notificationSoundRef = useRef<HTMLAudioElement | null>(null);

  // Função para reproduzir som otimizada (mais leve e confiável)
  const playBeepSound = useCallback(() => {
    // Verificar se o navegador suporta áudio
    if (!window.AudioContext && !(window as any).webkitAudioContext) {
      return false;
    }
    
    // Verificar se o usuário já concedeu permissão para áudio
    const soundPermissionGranted = localStorage.getItem('soundPermissionGranted') === 'true';
    if (!soundPermissionGranted) {
      // Se não temos permissão, tentar solicitar silenciosamente
      try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        const tempContext = new AudioContext();
        tempContext.close();
        localStorage.setItem('soundPermissionGranted', 'true');
      } catch (e) {
        // Ignora silenciosamente
      }
    }
    
    try {
      // Método simplificado: usar Audio API padrão em vez de Web Audio API
      // Isso é mais compatível com todos os navegadores, incluindo mobile
      const audio = new Audio();
      audio.src = '/sounds/notification.mp3';  // Caminho para o som de notificação
      
      // Definir volume para não ser intrusivo
      audio.volume = 0.3;
      
      // Tentar reproduzir o som
      const playPromise = audio.play();
      
      // Lidar com o caso de o navegador recusar a reprodução
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          // Plano B: tentar com Web Audio API se o método simples falhar
          try {
            const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
            const context = new AudioContext();
            const oscillator = context.createOscillator();
            
            oscillator.type = 'sine';
            oscillator.frequency.value = 880;
            oscillator.connect(context.destination);
            
            oscillator.start();
            setTimeout(() => {
              oscillator.stop();
              context.close();
            }, 200);
          } catch (err) {
            // Silenciosamente ignorar se falhar
          }
        });
      }
      
      return true;
    } catch (error) {
      return false;
    }
  }, []);

  // Inicialização para verificar permissão de áudio (será executado apenas uma vez)
  useEffect(() => {
    // Tentar obter permissão de áudio assim que o componente montar
    try {
      // Criar contexto de áudio e fechar imediatamente (isso já solicita permissão)
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContext) {
        const context = new AudioContext();
        setTimeout(() => context.close(), 100);
        console.log("Permissão de áudio solicitada na inicialização");
        
        // Vamos salvar a permissão no localStorage para usar depois
        localStorage.setItem('soundPermissionGranted', 'true');
      }
    } catch (e) {
      console.error("Falha ao inicializar áudio:", e);
    }
  }, []);

  // Referência para armazenar o hash dos IDs de atividades para comparação precisa
  const prevActivitiesHashRef = useRef<string>("");
  
  // Função para gerar um hash das atividades baseado em IDs
  const generateActivitiesHash = (activities: ActivityWithNotes[]) => {
    // Ordenar IDs para garantir consistência, mesmo se a ordem mudar
    const sortedIds = activities.map(a => a.id).sort((a, b) => a - b);
    return sortedIds.join(',');
  };

  // Verificar se há novas atividades e tocar som se houver
  useEffect(() => {
    // Não fazer nada se não temos dados ainda
    if (!activitiesData || activitiesData.length === 0) return;
    
    // Gerar hash atual das atividades
    const currentHash = generateActivitiesHash(activitiesData);
    
    // Se é a primeira carga de atividades, apenas atualizar a referência sem tocar som
    if (prevActivitiesCountRef.current === 0 || prevActivitiesHashRef.current === "") {
      prevActivitiesCountRef.current = activitiesData.length;
      prevActivitiesHashRef.current = currentHash;
      console.log(`Configurando hash inicial: ${currentHash} com ${prevActivitiesCountRef.current} atividades`);
      return;
    }
    
    // Só tocamos som se: contagem aumentou E o hash mudou (indica novas atividades reais)
    if (activitiesData.length > prevActivitiesCountRef.current && currentHash !== prevActivitiesHashRef.current) {
      console.log(`🔔 NOVAS ATIVIDADES CONFIRMADAS! Anterior: ${prevActivitiesCountRef.current}, Atual: ${activitiesData.length}`);
      console.log(`Hash anterior: ${prevActivitiesHashRef.current}`);
      console.log(`Hash atual: ${currentHash}`);
      
      // Tocar som imediatamente usando todas as abordagens disponíveis
      try {
        // 1. Nossa função principal
        playBeepSound();
        
        // 2. Tentar via função global "MODO DEUS"
        if ((window as any).modoDeusSom) {
          (window as any).modoDeusSom('new-activity');
        }
        
        // 3. Tentar via função global legada
        if ((window as any).tocarSomTeste) {
          (window as any).tocarSomTeste('new-activity');
        }
        
        // 4. Último recurso: API de áudio nativa
        try {
          const audio = new Audio();
          audio.src = '/notification-sound.mp3';
          audio.volume = 0.5;
          audio.play().catch(e => console.log("Erro ao tocar áudio nativo:", e));
        } catch (e) {
          console.error("Abordagem de áudio nativo falhou:", e);
        }
        
        // Mostrar notificação na tela também
        toast({
          title: "🔔 Novas atividades chegaram!",
          description: `Você tem novas atividades para processar.`,
          variant: "default",
        });
      } catch (error) {
        console.error("Todas as tentativas de tocar som falharam:", error);
      }
    }
    
    // Atualizar a contagem de atividades para a próxima comparação
    prevActivitiesCountRef.current = activitiesData?.length || 0;
  }, [activitiesData, playBeepSound, toast]);
  
  // Configurando atualização periódica otimizada (polling eficiente)
  useEffect(() => {
    if (userDepartment && user) {
      // Carregar dados imediatamente ao montar o componente (apenas uma vez)
      refetchActivities();
      
      // Configurar atualização periódica mais eficiente (a cada 15 segundos)
      const intervalId = setInterval(() => {
        // Verificar se a aba está ativa - se não estiver, diminuir a frequência
        const isTabActive = document.visibilityState === 'visible';
        
        // Se a aba não estiver ativa, reduzimos as requisições - não precisamos executar
        if (!isTabActive) return;
        
        // Fetch com menos logging para reduzir ruído na console
        refetchActivities().then(response => {
          const newActivities = response?.data;
          
          // Não fazer nada se não recebemos dados válidos
          if (!newActivities || newActivities.length === 0) return;
          
          // Gerar hash atual das atividades (mais eficiente)
          const currentHash = generateActivitiesHash(newActivities);
          
          // Verificar apenas se temos novas atividades por hash
          if (newActivities.length > prevActivitiesCountRef.current && 
              prevActivitiesCountRef.current > 0 && 
              currentHash !== prevActivitiesHashRef.current) {
            
            // Tocar som apenas uma vez de forma simplificada
            playBeepSound();
            
            // Atualizar hash e contagem imediatamente para evitar tocar som múltiplas vezes
            prevActivitiesHashRef.current = currentHash;
            prevActivitiesCountRef.current = newActivities.length;
            
            // Mostrar notificação uma única vez
            toast({
              title: "Novas atividades chegaram!",
              description: `Você tem novas atividades para processar.`,
              variant: "default",
            });
          } else {
            // Mesmo sem novas atividades, atualizar contagens para evitar erros
            prevActivitiesCountRef.current = newActivities.length;
            prevActivitiesHashRef.current = currentHash;
          }
        });
      }, 15000); // 15 segundos (menos frequente para reduzir carga)
      
      // Limpar intervalo ao desmontar
      return () => clearInterval(intervalId);
    }
  }, [userDepartment, user, refetchActivities, playBeepSound, toast]);
  
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
    // Não tocar som ao atualizar manualmente - só recarregar a página
    // Removido: playBeepSound();
    
    // Recarregar a página completamente (como o F5)
    window.location.reload();
  };
  
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
          
          {/* Botão de Som MODO DEUS - sem reproduzir som ao ser clicado */}
          <Button 
            variant="outline"
            size="sm"
            onClick={() => {
              // Solicitar permissão para áudio sem reproduzir som
              try {
                // Criar contexto de áudio e fechar imediatamente (isso já solicita permissão)
                const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
                if (AudioContext) {
                  const context = new AudioContext();
                  setTimeout(() => context.close(), 100);
                  console.log("✅ Permissão para som solicitada e concedida");
                  
                  // Salvar a permissão no localStorage para uso futuro
                  localStorage.setItem('soundPermissionGranted', 'true');
                  
                  // Mostrar toast de confirmação
                  toast({
                    title: "Notificações sonoras ativadas",
                    description: "Você receberá alertas sonoros quando novos pedidos chegarem.",
                    variant: "default"
                  });
                }
              } catch (error) {
                console.error("Erro ao solicitar permissão de áudio:", error);
              }
            }}
            className="flex items-center px-3 py-1 bg-blue-100 text-blue-800 hover:bg-blue-200 border-blue-300 animate-pulse"
          >
            Ativar Notificações Sonoras
          </Button>
                    
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleRefresh}
            className="flex items-center gap-1"
          >
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </Button>
          
          {/* Botão de teste de som */}
          <SoundTestButton />
        </div>
        
        {!userLoading && <SoundToggleButton />}
      </div>
      
      {userLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-brand" />
        </div>
      ) : (
        <>
          {!statsLoading && (
            <div className="grid grid-cols-2 gap-4 mb-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg font-semibold">Atividades Pendentes</CardTitle>
                  <CardDescription>Atividades aguardando processamento</CardDescription>
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
          )}
          
          {/* Seção de Atividades Pendentes (sempre exibida) */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="h-5 w-5 text-blue-600" />
              <h2 className="text-xl font-semibold">Atividades Pendentes</h2>
            </div>
            
            <Card>
              <CardHeader>
                <CardTitle>Atividades Pendentes</CardTitle>
                <CardDescription>
                  Lista de atividades que precisam ser processadas pelo seu departamento
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Carregamento de atividades com esqueleto */}
                {activitiesLoading ? (
                  <ActivitySkeleton />
                ) : activitiesData && activitiesData.length > 0 ? (
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
          </div>
          
          {/* Seção de Reimpressão para o setor de BATIDA - separada como uma seção completa */}
          {userDepartment === "batida" && (
            <div className="mt-12 pb-6">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                  <Printer className="h-5 w-5 text-blue-600" />
                  <h2 className="text-xl font-semibold">Sistema de Reimpressão</h2>
                </div>
                
                {/* Botão destacado para nova solicitação de reimpressão */}
                <Button 
                  variant="default" 
                  className="flex items-center bg-blue-600 hover:bg-blue-700"
                  onClick={() => {
                    // Selecionar o primeiro item da lista ou exibir mensagem
                    if (activitiesData && activitiesData.length > 0) {
                      setReprintActivity(activitiesData[0]);
                    } else {
                      toast({
                        title: "Nenhuma atividade disponível",
                        description: "Não há atividades disponíveis para solicitar reimpressão.",
                        variant: "destructive"
                      });
                    }
                  }}
                >
                  <Printer className="h-4 w-4 mr-2" />
                  Nova Solicitação
                </Button>
              </div>
              
              <Card>
                <CardHeader>
                  <CardTitle>Solicitar Reimpressão</CardTitle>
                  <CardDescription>
                    Solicite reimpressão de peças que apresentaram problemas
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {/* Lista de atividades disponíveis para reimpressão */}
                    <div>
                      <h3 className="text-lg font-semibold mb-4">Pedidos Disponíveis</h3>
                      {activitiesData && activitiesData.length > 0 ? (
                        <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2">
                          {activitiesData.map((activity) => (
                            <div
                              key={activity.id}
                              className="border rounded-lg p-4 hover:bg-neutral-50 transition-colors"
                            >
                              <div className="flex justify-between items-start">
                                <div>
                                  <h3 className="text-lg font-semibold">{activity.title}</h3>
                                  <p className="text-neutral-600 line-clamp-2 my-2">
                                    {activity.description}
                                  </p>
                                </div>
                                
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="flex items-center text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                  onClick={() => setReprintActivity(activity)}
                                >
                                  <Printer className="h-4 w-4 mr-1" />
                                  <span>Solicitar</span>
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 bg-neutral-50 rounded-md border border-dashed">
                          <Printer className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-30" />
                          <p className="text-neutral-500">
                            Nenhuma atividade disponível para reimpressão.
                          </p>
                        </div>
                      )}
                    </div>
                    
                    {/* Lista de solicitações de reimpressão */}
                    <div className="mt-8">
                      <h3 className="text-lg font-semibold mb-4">Minhas Solicitações</h3>
                      <ReprintRequestsList department={userDepartment} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
          
          {/* Seção de Reimpressão para o setor de IMPRESSÃO - separada como uma seção completa */}
          {userDepartment === "impressao" && (
            <div className="mt-12 pb-6">
              <div className="flex items-center gap-2 mb-4">
                <Printer className="h-5 w-5 text-blue-600" />
                <h2 className="text-xl font-semibold">Solicitações de Reimpressão</h2>
              </div>
              
              <Card>
                <CardHeader>
                  <CardTitle>Reimpressões Pendentes</CardTitle>
                  <CardDescription>
                    Lista de reimpressões solicitadas pelo setor de batida
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ReprintRequestsList department={userDepartment} />
                </CardContent>
              </Card>
            </div>
          )}
          
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
          
          {/* Modal de solicitação de reimpressão */}
          <ReprintRequestModal
            isOpen={!!reprintActivity}
            onClose={() => setReprintActivity(null)}
            activity={reprintActivity}
          />
        </>
      )}
    </Layout>
  );
}