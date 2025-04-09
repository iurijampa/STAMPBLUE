import { useAuth } from './use-auth';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useToast } from './use-toast';
import { queryClient } from '@/lib/queryClient';
import { useSoundPlayer, SoundType } from '@/components/sound-player';
import { useBrowserNotification } from './use-browser-notification';

// Intervalo para heartbeat (ping/pong) para manter a conexão ativa - 45 segundos
// Aumentado para reduzir sobrecarga de comunicação
const HEARTBEAT_INTERVAL = 45000;
// Intervalo para reconexão após falha - começa em 3 segundos e dobra até um máximo de 20 segundos
// Reduzindo a frequência de tentativas mas mantendo capacidade de recuperação
const INITIAL_RECONNECT_DELAY = 3000;
const MAX_RECONNECT_DELAY = 20000;
// Número máximo de tentativas consecutivas de reconexão antes de pausar
const MAX_RECONNECT_ATTEMPTS = 5;
// Tempo de pausa entre séries de tentativas (2 minutos)
const RECONNECT_PAUSE = 120000;

export function useWebSocket() {
  const { user } = useAuth();
  const socketRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { playSound } = useSoundPlayer();
  const { isSupported, permission, requestPermission, notify } = useBrowserNotification();
  
  // Referências para controle de reconexão e ping
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectDelayRef = useRef(INITIAL_RECONNECT_DELAY);
  const reconnectAttemptsRef = useRef(0);
  const pendingPongRef = useRef(false);
  
  // Flag para controlar se o componente está montado
  const isMountedRef = useRef(true);
  
  // Solicitar permissão para notificações do navegador quando o componente for montado
  useEffect(() => {
    if (isSupported && permission !== 'granted') {
      const askForPermission = async () => {
        await requestPermission();
      };
      askForPermission();
    }
    
    return () => {
      isMountedRef.current = false;
    };
  }, [isSupported, permission, requestPermission]);
  
  // Atualizar dados quando o WebSocket não está disponível
  // Referência para armazenar o timestamp da última atualização de dados
  const lastUpdateRef = useRef<number | null>(null);
  
  const refreshDataPeriodically = useCallback(async () => {
    if (!user) return;
    
    try {
      // Registrar quando a última atualização ocorreu
      const now = Date.now();
      const lastUpdateTime = lastUpdateRef.current;
      
      // Só atualizar se tiver passado pelo menos 10 segundos desde a última atualização
      // Isso evita múltiplas atualizações simultâneas em curto período
      if (lastUpdateTime && now - lastUpdateTime < 10000) {
        console.log('Ignorando atualização frequente - última há', Math.floor((now - lastUpdateTime)/1000), 'segundos');
        return;
      }
      
      console.log(`Atualizando dados para ${user.role} via polling...`);
      lastUpdateRef.current = now;
      
      // Atualizar atividades e estatísticas do departamento via polling quando o WebSocket não funciona
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['/api/department/activities', user.role] }),
        queryClient.invalidateQueries({ queryKey: ['/api/department/stats', user.role] }),
        queryClient.invalidateQueries({ queryKey: ['/api/activities'] })
      ]);
    } catch (err) {
      console.error('Erro ao atualizar dados:', err);
    }
  }, [user]);
  
  // Enviar heartbeat otimizado para manter a conexão ativa
  const sendHeartbeat = useCallback(() => {
    // Verificar se a conexão está aberta antes de tentar enviar
    if (socketRef.current?.readyState !== WebSocket.OPEN) {
      console.log('WebSocket não está aberto para enviar heartbeat');
      return;
    }
    
    // Se ainda estamos esperando uma resposta do ping anterior, a conexão pode estar inativa
    if (pendingPongRef.current) {
      console.log('Ainda aguardando resposta do ping anterior. A conexão pode estar inativa');
      
      // Resetar o estado e fechar a conexão atual para forçar reconexão
      pendingPongRef.current = false;
      if (socketRef.current) {
        try {
          socketRef.current.close(1000, "Ping timeout");
        } catch (e) {
          console.error("Erro ao fechar conexão após timeout de ping:", e);
        }
      }
      return;
    }
    
    try {
      // Enviar ping e aguardar resposta
      socketRef.current.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
      pendingPongRef.current = true;
      
      // Timeout mais curto para verificar se recebemos resposta do ping
      const timeoutId = setTimeout(() => {
        if (!isMountedRef.current) return;
        
        if (pendingPongRef.current) {
          console.log('Timeout de ping/pong (10s), reconectando...');
          pendingPongRef.current = false;
          
          if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
            try {
              socketRef.current.close(1000, "Ping timeout");
            } catch (e) {
              console.error("Erro ao fechar conexão após timeout de ping:", e);
            }
          }
        }
      }, 10000); // 10 segundos de timeout
      
      return () => clearTimeout(timeoutId);
    } catch (error) {
      console.error("Erro ao enviar ping:", error);
      pendingPongRef.current = false;
    }
  }, []);
  
  // Função para enviar mensagens para o WebSocket
  const sendMessage = useCallback((data: any) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(data));
      return true;
    }
    return false;
  }, []);
  
  // Registrar-se com um departamento específico
  const registerWithDepartment = useCallback((department: string) => {
    if (department) {
      return sendMessage({
        type: 'register',
        department
      });
    }
    return false;
  }, [sendMessage]);
  
  // Mostrar notificação na aba do navegador
  const showBrowserNotification = useCallback((title: string, body: string, tag?: string) => {
    // Só mostrar notificação se a página não estiver em foco e permissão estiver concedida
    if (isSupported && permission === 'granted' && !document.hasFocus()) {
      notify({
        title,
        body,
        tag,
        icon: '/logo-stamp-blue.png',
        onClick: () => {
          // Forçar uma atualização dos dados quando o usuário clica na notificação
          refreshDataPeriodically();
        }
      });
    }
  }, [isSupported, permission, notify, refreshDataPeriodically]);
  
  // Limpar intervalos e timeouts para evitar vazamentos de memória
  const clearTimers = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);
  
  // Função de conexão WebSocket com reconexão automática
  const connect = useCallback(() => {
    clearTimers();
    
    // Não tentar conectar se o usuário não está logado
    if (!user) return;
    
    try {
      // Fechar conexão anterior se existir
      if (socketRef.current) {
        socketRef.current.close();
      }
      
      // Definir o protocolo com base no protocolo do site
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      
      // Criar nova conexão WebSocket com um timestamp para evitar cache
      const socket = new WebSocket(`${wsUrl}?t=${Date.now()}`);
      socketRef.current = socket;
      
      // Manipulador de eventos para quando a conexão for aberta
      socket.onopen = () => {
        if (!isMountedRef.current) return;
        
        console.log('WebSocket conectado com sucesso!');
        setConnected(true);
        setError(null);
        
        // Resetar o atraso de reconexão e contagem de tentativas
        reconnectDelayRef.current = INITIAL_RECONNECT_DELAY;
        reconnectAttemptsRef.current = 0;
        
        // Registrar-se com o departamento do usuário
        registerWithDepartment(user.role);
        
        // Iniciar heartbeat
        clearTimers();
        heartbeatIntervalRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);
      };
      
      // Manipulador de eventos para mensagens recebidas
      socket.onmessage = (event) => {
        if (!isMountedRef.current) return;
        
        try {
          const data = JSON.parse(event.data);
          
          // Resposta a heartbeat (ping)
          if (data.type === 'pong') {
            pendingPongRef.current = false;
            return;
          }
          
          console.log('Mensagem WebSocket recebida:', data);
          
          // Processar diferentes tipos de mensagens
          if (data.type === 'register_confirm') {
            toast({
              title: 'Conexão estabelecida',
              description: `Atualizações em tempo real ativadas para ${
                data.department === 'admin' ? 'Administração' : data.department
              }`,
              variant: 'default',
            });
          } 
          else if (data.type === 'new_activity') {
            // Invalidar cache para atualizar lista de atividades
            queryClient.invalidateQueries({ queryKey: ['/api/department/activities', user.role] });
            queryClient.invalidateQueries({ queryKey: ['/api/activities'] });
            
            // Reproduzir som de notificação bem chamativo
            playSound('NEW_ACTIVITY', 1.0);
            
            // Notificação na aba do navegador
            showBrowserNotification(
              'Novo Pedido Recebido', 
              `O pedido "${data.activity.title}" está disponível para seu setor.`,
              `new-activity-${data.activity.id}`
            );
            
            // Notificar usuário sobre nova atividade
            toast({
              title: 'Novo Pedido Recebido',
              description: `O pedido "${data.activity.title}" está disponível para seu setor.`,
              variant: 'default',
            });
          } 
          else if (data.type === 'activity_returned') {
            // Invalidar cache para atualizar lista de atividades
            queryClient.invalidateQueries({ queryKey: ['/api/department/activities', user.role] });
            queryClient.invalidateQueries({ queryKey: ['/api/activities'] });
            
            // Reproduzir som de alerta para pedidos retornados
            playSound('RETURN_ALERT', 1.0);
            
            // Notificação na aba do navegador
            showBrowserNotification(
              'Pedido Retornado', 
              `O pedido "${data.activity.title}" foi retornado por ${data.returnedBy || 'alguém'} do setor ${data.from}.`,
              `return-activity-${data.activity.id}`
            );
            
            // Notificar usuário sobre pedido retornado
            toast({
              title: 'Pedido Retornado',
              description: `O pedido "${data.activity.title}" foi retornado por ${data.returnedBy || 'alguém'} do setor ${data.from}.`,
              variant: 'destructive',
            });
          } 
          else if (data.type === 'activity_returned_update' || data.type === 'activity_completed') {
            // Invalidar cache para atualizar lista de atividades
            queryClient.invalidateQueries({ queryKey: ['/api/department/activities', user.role] });
            queryClient.invalidateQueries({ queryKey: ['/api/activities'] });
            queryClient.invalidateQueries({ queryKey: ['/api/department/stats', user.role] });
            
            // Som sutil de atualização
            playSound('UPDATE', 0.7);
          } 
          else if (data.type === 'activity_progress') {
            // Invalidar cache para atualizar lista de atividades e progresso
            queryClient.invalidateQueries({ queryKey: ['/api/department/activities', user.role] });
            queryClient.invalidateQueries({ queryKey: ['/api/activities'] });
            queryClient.invalidateQueries({ queryKey: ['/api/activities/progress'] });
            queryClient.invalidateQueries({ queryKey: ['/api/department/stats', user.role] });
            queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
            
            // Som de atualização
            playSound('UPDATE', 0.8);
            
            // Notificar admins sobre o progresso de atividades
            if (user.role === 'admin') {
              if (data.isCompleted) {
                toast({
                  title: 'Produção Concluída',
                  description: `O pedido "${data.activity.title}" foi finalizado por ${data.completedBy} no setor ${data.department}.`,
                  variant: 'default',
                });
                
                showBrowserNotification(
                  'Produção Concluída', 
                  `O pedido "${data.activity.title}" foi finalizado por ${data.completedBy} no setor ${data.department}.`,
                  `complete-activity-${data.activity.id}`
                );
              } else {
                toast({
                  title: 'Pedido Avançou',
                  description: `Pedido "${data.activity.title}" passou de ${data.department} para ${data.nextDepartment}.`,
                  variant: 'default',
                });
                
                showBrowserNotification(
                  'Pedido Avançou', 
                  `Pedido "${data.activity.title}" passou de ${data.department} para ${data.nextDepartment}.`,
                  `progress-activity-${data.activity.id}`
                );
              }
            }
          }
        } catch (err) {
          console.error('Erro ao processar mensagem WebSocket:', err);
        }
      };
      
      // Manipulador de eventos para erros
      socket.onerror = (event) => {
        if (!isMountedRef.current) return;
        
        console.error('Erro WebSocket:', event);
        setError('Ocorreu um erro na conexão.');
        setConnected(false);
      };
      
      // Manipulador de eventos para fechamento da conexão
      socket.onclose = (event) => {
        if (!isMountedRef.current) return;
        
        console.log('WebSocket desconectado:', event);
        setConnected(false);
        
        // Limpar heartbeat
        clearTimers();
        
        // Iniciar atualização periódica para compensar a falta de WebSocket
        refreshDataPeriodically();
        
        // Tentar reconectar com backoff exponencial e limites
        if (user) {
          reconnectAttemptsRef.current += 1;
          
          // Verificar se atingimos o limite de tentativas consecutivas
          if (reconnectAttemptsRef.current > MAX_RECONNECT_ATTEMPTS) {
            console.log(`Limite de ${MAX_RECONNECT_ATTEMPTS} tentativas atingido. Pausando por ${RECONNECT_PAUSE/1000} segundos`);
            
            // Após muitas tentativas, pausar por um tempo maior para evitar 
            // sobrecarga de rede e então reiniciar o contador
            reconnectTimeoutRef.current = setTimeout(() => {
              if (isMountedRef.current) {
                // Resetar contador e delay para começar uma nova série de tentativas
                reconnectAttemptsRef.current = 0;
                reconnectDelayRef.current = INITIAL_RECONNECT_DELAY;
                connect();
              }
            }, RECONNECT_PAUSE);
            
            return;
          }
          
          // Calcular o próximo atraso (aumentar o atraso gradualmente)
          const nextDelay = Math.min(
            reconnectDelayRef.current * Math.pow(1.3, Math.min(reconnectAttemptsRef.current - 1, 4)),
            MAX_RECONNECT_DELAY
          );
          reconnectDelayRef.current = nextDelay;
          
          console.log(`Tentando reconectar em ${nextDelay / 1000} segundos (tentativa ${reconnectAttemptsRef.current} de ${MAX_RECONNECT_ATTEMPTS})...`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            if (isMountedRef.current) {
              connect();
            }
          }, nextDelay);
        }
      };
    } catch (err) {
      if (!isMountedRef.current) return;
      
      console.error('Erro ao configurar WebSocket:', err);
      setError('Não foi possível estabelecer conexão.');
      setConnected(false);
      
      // Tentar novamente após um atraso
      reconnectTimeoutRef.current = setTimeout(() => {
        if (isMountedRef.current) {
          connect();
        }
      }, reconnectDelayRef.current);
    }
  }, [
    user, 
    registerWithDepartment, 
    clearTimers, 
    showBrowserNotification, 
    refreshDataPeriodically, 
    toast, 
    playSound, 
    sendHeartbeat
  ]);
  
  // Conectar ao WebSocket quando o componente for montado ou o usuário mudar
  useEffect(() => {
    isMountedRef.current = true;
    
    if (user) {
      connect();
      
      // Atualizar dados imediatamente, sem esperar pelo WebSocket
      refreshDataPeriodically();
      
      // Configurar um intervalo para atualizar dados periodicamente quando o WebSocket não estiver conectado
      // Usando um intervalo maior (2 minutos) para reduzir a carga no servidor
      const pollingInterval = setInterval(() => {
        if (!connected) {
          // Se não estiver conectado, atualizar dados via polling
          // Mas só se o último update foi há mais de 30 segundos
          const now = Date.now();
          const lastUpdateTime = lastUpdateRef.current;
          const timeSinceLastUpdate = lastUpdateTime ? now - lastUpdateTime : Infinity;
          
          // Se passaram mais de 30 segundos desde a última atualização, buscar novos dados
          if (timeSinceLastUpdate > 30000) {
            console.log('WebSocket desconectado, atualizando via polling...');
            refreshDataPeriodically();
          } else {
            console.log(`WebSocket desconectado, mas última atualização foi recente (${Math.floor(timeSinceLastUpdate/1000)}s). Aguardando...`);
          }
        }
      }, 120000); // Atualizar a cada 2 minutos se o WebSocket não estiver conectado
      
      // Função de limpeza
      return () => {
        isMountedRef.current = false;
        clearTimers();
        clearInterval(pollingInterval);
        
        if (socketRef.current) {
          socketRef.current.close();
          socketRef.current = null;
        }
      };
    }
    
    return () => {
      isMountedRef.current = false;
    };
  }, [user, connect, refreshDataPeriodically, clearTimers, connected]);
  
  // Adicionar listener para visibilidade da página
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Atualizar dados quando o usuário volta para a aba
        refreshDataPeriodically();
        
        // Reconectar WebSocket se estiver desconectado
        if (!connected && user) {
          connect();
        }
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [connected, connect, refreshDataPeriodically, user]);
  
  return {
    connected,
    error,
    sendMessage,
    registerWithDepartment,
    playSound, // Exportar a função de reprodução de som para uso direto
    refreshData: refreshDataPeriodically // Exportar função para atualizar dados manualmente
  };
}