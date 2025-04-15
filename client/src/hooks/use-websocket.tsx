import { useAuth } from './use-auth';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useToast } from './use-toast';
import { queryClient } from '@/lib/queryClient';

// CONFIGURAÇÃO OTIMIZADA PARA MÁXIMA ESTABILIDADE E MENOR CONSUMO DE RECURSOS
// Intervalo para heartbeat mais longo para reduzir tráfego
const HEARTBEAT_INTERVAL = 120000; // 2 minutos - reduz tráfego de rede
// Estratégia de back-off exponencial para reconexão mais suave
const INITIAL_RECONNECT_DELAY = 2000; // 2 segundos inicial para evitar tempestade de conexões
const MAX_RECONNECT_DELAY = 45000; // máximo 45 segundos para longos períodos sem conexão
// Menos tentativas antes de pausa
const MAX_RECONNECT_ATTEMPTS = 3; // Reduzido para menos tentativas com tempo maior entre elas
// Pausa mais longa entre séries de tentativas para dar tempo ao servidor se recuperar
const RECONNECT_PAUSE = 20000; // 20 segundos
// Intervalo mínimo maior entre atualizações via polling para evitar sobrecarga
const MIN_POLLING_INTERVAL = 10000; // 10 segundos - menor número de chamadas desnecessárias

export function useWebSocket() {
  const { user } = useAuth();
  const socketRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  
  // Criamos eventos para notificar sobre mensagens em vez de chamar diretamente
  const [messageData, setMessageData] = useState<any>(null);
  
  // Referências para controle de reconexão e ping
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectDelayRef = useRef(INITIAL_RECONNECT_DELAY);
  const reconnectAttemptsRef = useRef(0);
  const pendingPongRef = useRef(false);
  
  // Flag para controlar se o componente está montado
  const isMountedRef = useRef(true);
  
  // Definir quando o componente está desmontado
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  
  // Atualizar dados quando o WebSocket não está disponível
  // Referência para armazenar o timestamp da última atualização de dados
  const lastUpdateRef = useRef<number | null>(null);
  
  const refreshDataPeriodically = useCallback(async () => {
    if (!user) return;
    
    try {
      // Registrar quando a última atualização ocorreu
      const now = Date.now();
      const lastUpdateTime = lastUpdateRef.current;
      
      // MODO DE EMERGÊNCIA: Reduzir drasticamente o tempo entre atualizações
      // Agora só bloqueia se tiver passado menos de 2 segundos (antes era 10)
      if (lastUpdateTime && now - lastUpdateTime < 2000) {
        console.log('Ignorando atualização muito frequente - última há', Math.floor((now - lastUpdateTime)/1000), 'segundos');
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
      
      // Após atualizar os dados, notificar os componentes que possam estar interessados
      // Isso simula o recebimento de uma mensagem WebSocket
      setMessageData({ type: 'data_refreshed', timestamp: Date.now() });
      
      // Após 500ms, verificar se houve mudanças nos dados e notificar
      setTimeout(() => {
        // Enviar um evento de som para garantir que o sistema verifique por novas atividades
        setMessageData({ type: 'sound', soundType: 'check_activities' });
      }, 500);
      
    } catch (err) {
      console.error('Erro ao atualizar dados:', err);
    }
  }, [user]);
  
  // Função para forçar atualização de dados diretamente (sem esperar pelo WebSocket)
  const updateDataFromServer = useCallback(() => {
    refreshDataPeriodically();
  }, [refreshDataPeriodically]);
  
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
      
      // Timeout mais tolerante para evitar desconexões desnecessárias
      const timeoutId = setTimeout(() => {
        if (!isMountedRef.current) return;
        
        if (pendingPongRef.current) {
          console.log('Timeout de ping/pong (8s), iniciando reconexão programada...');
          pendingPongRef.current = false;
          
          // Verificar se a conexão ainda está aberta
          if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
            try {
              // Tentar enviar um ping adicional antes de desistir
              try {
                socketRef.current.send(JSON.stringify({ type: 'ping', timestamp: Date.now(), retry: true }));
                
                // Dar uma segunda chance antes de fechar
                setTimeout(() => {
                  if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
                    console.log('Segunda tentativa de ping falhou, fechando conexão...');
                    socketRef.current.close(1000, "Ping timeout");
                  }
                }, 5000);
                
                return;
              } catch (pingError) {
                // Se falhar ao enviar, aí sim fechamos
                socketRef.current.close(1000, "Ping timeout");
              }
            } catch (e) {
              console.error("Erro ao fechar conexão após timeout de ping:", e);
            }
          }
        }
      }, 8000); // 8 segundos de timeout - muito mais tolerante
      
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
  
  // Mostrar notificação na aba do navegador - só um stub para manter compatibilidade
  const showBrowserNotification = useCallback((_title: string, _body: string, _tag?: string) => {
    // Função vazia para compatibilidade
    return;
  }, []);
  
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
            
            // Tocar som usando Audio API diretamente (método extremamente simples)
            try {
              const audio = new Audio('/notification-sound.mp3');
              audio.volume = 0.5;
              audio.play().catch(err => {
                console.error('Erro ao tocar notificação:', err);
              });
              console.log('Som de nova atividade tocado com sucesso!');
            } catch (error) {
              console.error('Erro ao tocar som de nova atividade:', error);
            }
            
            // Emitir evento de nova atividade para o componente SimpleSoundPlayer (reforço)
            setMessageData({ type: 'sound', soundType: 'new-activity' });
            
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
            
            // Tocar som de alerta usando Audio API diretamente (método extremamente simples)
            try {
              const audio = new Audio('/alert-sound.mp3');
              audio.volume = 0.6;
              audio.play().catch(err => {
                console.error('Erro ao tocar alerta:', err);
              });
              console.log('Som de retorno tocado com sucesso!');
            } catch (error) {
              console.error('Erro ao tocar som de retorno:', error);
            }
            
            // Emitir evento de retorno para o componente SimpleSoundPlayer (reforço)
            setMessageData({ type: 'sound', soundType: 'return-alert' });
            
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
            
            // Tocar som de atualização usando Audio API diretamente (método extremamente simples)
            try {
              const audio = new Audio('/update-sound.mp3');
              audio.volume = 0.4;
              audio.play().catch(err => {
                console.error('Erro ao tocar atualização:', err);
              });
              console.log('Som de atualização tocado com sucesso!');
            } catch (error) {
              console.error('Erro ao tocar som de atualização:', error);
            }
            
            // Emitir evento de atualização para o componente SimpleSoundPlayer (reforço)
            setMessageData({ type: 'sound', soundType: 'update' });
          } 
          else if (data.type === 'activity_progress') {
            // Invalidar cache para atualizar lista de atividades e progresso
            queryClient.invalidateQueries({ queryKey: ['/api/department/activities', user.role] });
            queryClient.invalidateQueries({ queryKey: ['/api/activities'] });
            queryClient.invalidateQueries({ queryKey: ['/api/activities/progress'] });
            queryClient.invalidateQueries({ queryKey: ['/api/department/stats', user.role] });
            queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
            
            // Tocar som de sucesso usando Audio API diretamente (método extremamente simples)
            try {
              const audio = new Audio('/notification-sound.mp3');
              audio.volume = 0.5;
              audio.play().catch(err => {
                console.error('Erro ao tocar sucesso:', err);
              });
              
              // Tocar um segundo som depois de um pequeno atraso
              setTimeout(() => {
                const audio2 = new Audio('/update-sound.mp3');
                audio2.volume = 0.4;
                audio2.play().catch(err => {
                  console.error('Erro ao tocar segundo som de sucesso:', err);
                });
              }, 200);
              
              console.log('Som de sucesso tocado com sucesso!');
            } catch (error) {
              console.error('Erro ao tocar som de sucesso:', error);
            }
            
            // Emitir evento de sucesso para o componente SimpleSoundPlayer (reforço)
            setMessageData({ type: 'sound', soundType: 'success' });
            
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
      
      // Manipulador de eventos para erros - MODO DE EMERGÊNCIA
      socket.onerror = (event) => {
        if (!isMountedRef.current) return;
        
        console.error('Erro WebSocket detectado, aguardando ciclo normal de reconexão...', event);
        setError('Reconectando...');
        setConnected(false);
        
        // Modo otimizado: Não forçar reconexão imediata para evitar tempestade de conexões
        // O manipulador onclose cuidará da reconexão com backoff exponencial
        try {
          if (socketRef.current) {
            // Fechar conexão atual de forma ordenada
            socketRef.current.close();
          }
        } catch (err) {
          console.error('Erro ao fechar conexão com erro:', err);
        }
      };
      
      // Manipulador de eventos para fechamento da conexão - MODO DE EMERGÊNCIA 
      socket.onclose = (event) => {
        if (!isMountedRef.current) return;
        
        console.log('WebSocket desconectado, iniciando reconexão inteligente...', event);
        setConnected(false);
        
        // Limpar heartbeat
        clearTimers();
        
        // Iniciar atualização periódica para compensar a falta de WebSocket
        // Verificar se passou tempo suficiente desde a última atualização
        const now = Date.now();
        const lastUpdate = lastUpdateRef.current || 0;
        if (now - lastUpdate > MIN_POLLING_INTERVAL) {
          refreshDataPeriodically();
        } else {
          console.log(`Adiando polling - última atualização há apenas ${Math.floor((now - lastUpdate)/1000)}s`);
        }
        
        // Reconexão com backoff exponencial
        if (user) {
          reconnectAttemptsRef.current += 1;
          
          // Verificar se atingimos o limite de tentativas consecutivas
          if (reconnectAttemptsRef.current > MAX_RECONNECT_ATTEMPTS) {
            console.log(`Limite de ${MAX_RECONNECT_ATTEMPTS} tentativas atingido. Pausa de ${RECONNECT_PAUSE/1000} segundos`);
            
            // Pausa antes de reiniciar o ciclo de reconexão
            reconnectTimeoutRef.current = setTimeout(() => {
              if (isMountedRef.current) {
                // Resetar contador e tentar novamente
                reconnectAttemptsRef.current = 0;
                reconnectDelayRef.current = INITIAL_RECONNECT_DELAY;
                
                // Forçar uma atualização imediata dos dados antes de reconectar
                try {
                  refreshDataPeriodically();
                  // Pequeno delay para garantir que os dados sejam atualizados
                  setTimeout(() => connect(), 100);
                } catch (err) {
                  console.error('Erro ao atualizar dados antes de reconectar:', err);
                  connect(); // Conectar mesmo se a atualização falhar
                }
              }
            }, RECONNECT_PAUSE);
            
            return;
          }
          
          // Calcular próximo delay com backoff exponencial
          // Factor = 1.5 (menos agressivo que o padrão 2.0)
          const backoffFactor = 1.5;
          // Aplicar jitter (variação aleatória) para evitar reconexões sincronizadas
          const jitter = Math.random() * 0.3 + 0.85; // 0.85-1.15
          
          let nextDelay = Math.min(
            reconnectDelayRef.current * backoffFactor * jitter,
            MAX_RECONNECT_DELAY
          );
          
          // Arredondar para um número inteiro
          nextDelay = Math.floor(nextDelay);
          reconnectDelayRef.current = nextDelay;
          
          console.log(`Reconexão inteligente em ${(nextDelay / 1000).toFixed(1)} segundos (tentativa ${reconnectAttemptsRef.current} de ${MAX_RECONNECT_ATTEMPTS})...`);
          
          // Agendar reconexão
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
    setMessageData, 
    sendHeartbeat
  ]);
  
  // Conectar ao WebSocket quando o componente for montado ou o usuário mudar
  useEffect(() => {
    isMountedRef.current = true;
    
    if (user) {
      connect();
      
      // Atualizar dados imediatamente, sem esperar pelo WebSocket
      refreshDataPeriodically();
      
      // Sistema de polling otimizado e adaptativo - mais inteligente para economizar recursos
      const pollingInterval = setInterval(() => {
        // Só fazer polling se realmente desconectado
        if (!connected) {
          // Verificar tempo desde a última atualização
          const now = Date.now();
          const lastUpdateTime = lastUpdateRef.current || 0;
          const timeSinceLastUpdate = now - lastUpdateTime;
          
          // Intervalo adaptativo mais inteligente baseado no tempo em que a página está aberta
          // Reduz drasticamente a frequência de polling para sessões longas
          const pageOpenTime = now - window.performance.timing.navigationStart;
          const pageOpenMinutes = pageOpenTime / (1000 * 60);
          
          // Calcular intervalo ideal entre polls - política mais conservadora
          // Começa com MIN_POLLING_INTERVAL e cresce exponencialmente com limitador
          // Aumentamos o máximo para 60s para sessões muito longas
          const idealInterval = Math.min(
            Math.max(
              MIN_POLLING_INTERVAL,
              MIN_POLLING_INTERVAL * (1 + Math.min(pageOpenMinutes / 10, 5)) // Crescimento mais rápido
            ),
            60000 // Máximo de 60s entre polls para sessões muito longas
          );
          
          if (timeSinceLastUpdate > idealInterval) {
            console.log(`Atualizando via polling (intervalo adaptativo: ${Math.floor(idealInterval/1000)}s)`);
            refreshDataPeriodically();
          } else {
            // Log ainda mais reduzido para minimizar ruído
            if (Math.random() < 0.2) { // Só logar 20% das vezes para reduzir spam
              console.log(`Aguardando intervalo entre polls (${Math.floor(timeSinceLastUpdate/1000)}/${Math.floor(idealInterval/1000)}s)`);
            }
          }
        }
      }, 20000); // Polling base a cada 20 segundos (ainda mais econômico)
      
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
    messageData, // Exportar dados de mensagem para o SoundManager
    refreshData: refreshDataPeriodically // Exportar função para atualizar dados manualmente
  };
}