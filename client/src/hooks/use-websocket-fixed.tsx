import { useAuth } from './use-auth';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useToast } from './use-toast';
import { queryClient } from '@/lib/queryClient';

// CONFIGURAÇÃO TURBO-OTIMIZADA - VERSÃO 2.0 COM SUPER DESEMPENHO
// Configurações de polling - otimização máxima para resposta instantânea
const MIN_POLLING_INTERVAL = 4500; // 4.5 segundos - atualizações ultra-frequentes para excelente responsividade
const MAX_POLLING_INTERVAL = 15000; // 15 segundos - intervalo máximo reduzido pela metade para dados sempre frescos
const POLLING_BACKOFF_FACTOR = 1.3; // Aumenta mais suavemente o tempo entre pollings

// Configurações de WebSocket - otimização para velocidade e confiabilidade
const HEARTBEAT_INTERVAL = 50000; // 50 segundos - mais frequente para detectar problemas mais rapidamente
const HEARTBEAT_TIMEOUT = 6000; // 6 segundos - timeout mais curto para detecção mais rápida de problemas
const WS_CONNECT_TIMEOUT = 5000; // 5 segundos - timeout reduzido para estabelecer conexão mais rapidamente

// Configurações de reconexão - estratégia ultra-rápida e resiliente
const INITIAL_RECONNECT_DELAY = 1000; // 1 segundo inicial - resposta instantânea no primeiro erro
const MAX_RECONNECT_DELAY = 20000; // 20 segundos - limite máximo reduzido drasticamente para recuperação rápida
const RECONNECT_BACKOFF_FACTOR = 1.4; // Fator de crescimento do atraso - balanceado
const JITTER_MAX = 0.15; // 15% de variação aleatória para evitar reconexões simultâneas
const MAX_RECONNECT_ATTEMPTS = 4; // 4 tentativas antes de pausa
const RECONNECT_PAUSE = 12000; // 12 segundos de pausa após várias tentativas
const MAX_CONSECUTIVE_ERRORS = 3; // Após apenas 3 erros, ativar polling mais agressivo

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
  const consecutiveErrorsRef = useRef(0); // Rastrear erros consecutivos
  
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
  
  // Função super-otimizada para atualizar dados periodicamente com recursos avançados
  const refreshDataPeriodically = useCallback(async () => {
    if (!user) return;
    
    try {
      // Registrar quando a última atualização ocorreu e calcular o tempo desde a última atualização
      const now = Date.now();
      const lastUpdateTime = lastUpdateRef.current;
      
      // Sistema de prevenção de atualização excessiva usando threshold adaptativo
      const minUpdateInterval = connected ? 1000 : 800; // Threshold reduzido para 0.8s quando WebSocket está desconectado
      
      if (lastUpdateTime && now - lastUpdateTime < minUpdateInterval) {
        console.log('Ignorando atualização muito frequente - última há', Math.floor((now - lastUpdateTime)/1000), 'segundos');
        return false; // Retorna false para indicar que não houve atualização
      }
      
      console.log(`Atualizando dados para ${user.role} via polling...`);
      lastUpdateRef.current = now; // Atualizar timestamp antes da operação para evitar solicitações simultâneas
      
      // Lista de queries para atualizar com prioridades diferentes
      const queries = [];
      
      // Sempre buscar atividades do departamento atual com alta prioridade
      queries.push(queryClient.invalidateQueries({ 
        queryKey: ['/api/department/activities', user.role],
        // Opções de invalidação otimizadas para melhor desempenho
        refetchType: 'active', // Recarregar apenas queries ativas
      }));
      
      // Buscar estatísticas do departamento
      queries.push(queryClient.invalidateQueries({ 
        queryKey: ['/api/department/stats', user.role],
        refetchType: 'active',
      }));
      
      // Para admin, buscar todas as atividades
      if (user.role === 'admin') {
        queries.push(queryClient.invalidateQueries({ 
          queryKey: ['/api/activities'],
          refetchType: 'active',
        }));
      }
      
      // Executar todas as atualizações em paralelo para máxima eficiência
      await Promise.all(queries);
      
      // Após atualizar os dados, notificar os componentes que possam estar interessados
      // Isso simula o recebimento de uma mensagem WebSocket
      setMessageData({ 
        type: 'data_refreshed', 
        timestamp: Date.now(),
        source: 'polling'
      });
      
      // Verificar imediatamente se há novas atividades (sem delay para maior responsividade)
      setMessageData({ 
        type: 'sound', 
        soundType: 'check_activities',
        timestamp: Date.now()
      });
      
      return true; // Retorna true para indicar sucesso
    } catch (err) {
      console.error('Erro ao atualizar dados:', err);
      return false; // Retorna false para indicar falha
    }
  }, [user, connected, queryClient]);
  
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
      
      // Timeout para detecção de falha na conexão inicial (7 segundos)
      const connectionTimeoutId = setTimeout(() => {
        // Se após 7 segundos ainda não recebemos onopen, a conexão falhou silenciosamente
        if (socketRef.current && socketRef.current.readyState !== WebSocket.OPEN) {
          console.log('Timeout de conexão WebSocket (7s), iniciando reconexão imediata...');
          
          try {
            // Tentar fechar a conexão atual e reconectar
            if (socketRef.current) {
              socketRef.current.close(1000, "Connection timeout");
            }
          } catch (e) {
            console.error("Erro ao fechar conexão após timeout:", e);
          }
          
          // Forçar atualização de dados via polling como fallback
          refreshDataPeriodically();
          
          // Iniciar reconexão com backoff exponencial
          // Se tivermos atingido o máximo de tentativas, fazer uma pausa maior
          if (reconnectAttemptsRef.current > MAX_RECONNECT_ATTEMPTS) {
            // Pausa maior antes de tentar novamente
            setTimeout(() => {
              reconnectAttemptsRef.current = 0;
              reconnectDelayRef.current = INITIAL_RECONNECT_DELAY;
              connect();
            }, RECONNECT_PAUSE);
          } else {
            // Caso contrário, tentativa normal com backoff
            reconnectAttemptsRef.current += 1;
            
            // Calcular atraso com jitter para evitar tempestade de conexões
            const jitter = 0.85 + (Math.random() * 0.3); // 0.85-1.15
            
            const delay = Math.min(
              reconnectDelayRef.current * RECONNECT_BACKOFF_FACTOR * jitter,
              MAX_RECONNECT_DELAY
            );
            
            console.log(`Reconexão imediata em ${(delay/1000).toFixed(1)}s após timeout de conexão...`);
            
            setTimeout(() => connect(), delay);
          }
        }
      }, WS_CONNECT_TIMEOUT);
      
      // Manipulador de eventos para mensagens recebidas
      socket.onmessage = (event) => {
        // Limpar o timeout de conexão inicial pois recebemos uma mensagem
        clearTimeout(connectionTimeoutId);
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
            queryClient.invalidateQueries({ queryKey: ['/api/activities/returned'] });
            // Atualizar estatísticas também
            queryClient.invalidateQueries({ queryKey: ['/api/department/stats', user.role] });
          }
          else if (data.type === 'reprint_request_update') {
            // Invalidar consultas relacionadas às solicitações de reimpressão
            queryClient.invalidateQueries({ queryKey: ['/api/reprint-requests'] });
            queryClient.invalidateQueries({ queryKey: ['/api/reprint-requests/department', user.role] });
            
            // Notificar usuário sobre atualização na solicitação
            if (data.status === 'em_andamento') {
              toast({
                title: 'Solicitação de Reimpressão em Andamento',
                description: `A solicitação para o pedido "${data.activityTitle}" foi aceita por ${data.processedBy || 'impressão'}.`,
                variant: 'default',
              });
              
              // Tocar som de confirmação
              try {
                const audio = new Audio('/confirm-sound.mp3');
                audio.volume = 0.5;
                audio.play().catch(err => {
                  console.error('Erro ao tocar som de confirmação:', err);
                });
              } catch (error) {
                console.error('Erro ao tocar som de confirmação:', error);
              }
              
              // Emitir evento de som para o componente SimpleSoundPlayer
              setMessageData({ type: 'sound', soundType: 'confirm-sound' });
            } 
            else if (data.status === 'concluido') {
              toast({
                title: 'Solicitação de Reimpressão Concluída',
                description: `A reimpressão para o pedido "${data.activityTitle}" foi finalizada por ${data.processedBy || 'impressão'}.`,
                variant: 'default',
              });
              
              // Tocar som de sucesso
              try {
                const audio = new Audio('/success-sound.mp3');
                audio.volume = 0.5;
                audio.play().catch(err => {
                  console.error('Erro ao tocar som de sucesso:', err);
                });
              } catch (error) {
                console.error('Erro ao tocar som de sucesso:', error);
              }
              
              // Emitir evento de som para o componente SimpleSoundPlayer
              setMessageData({ type: 'sound', soundType: 'success-sound' });
            }
            else if (data.status === 'cancelado') {
              toast({
                title: 'Solicitação de Reimpressão Cancelada',
                description: `A solicitação para o pedido "${data.activityTitle}" foi cancelada por ${data.processedBy || 'alguém'}.`,
                variant: 'destructive',
              });
              
              // Tocar som de alerta
              try {
                const audio = new Audio('/alert-sound.mp3');
                audio.volume = 0.5;
                audio.play().catch(err => {
                  console.error('Erro ao tocar som de alerta:', err);
                });
              } catch (error) {
                console.error('Erro ao tocar som de alerta:', error);
              }
              
              // Emitir evento de som para o componente SimpleSoundPlayer
              setMessageData({ type: 'sound', soundType: 'alert-sound' });
            }
          }
          else if (data.type === 'new_reprint_request') {
            // Invalidar consultas relacionadas às solicitações de reimpressão
            queryClient.invalidateQueries({ queryKey: ['/api/reprint-requests'] });
            queryClient.invalidateQueries({ queryKey: ['/api/reprint-requests/department', user.role] });
            
            // Tocar som usando Audio API diretamente (método extremamente simples)
            try {
              const audio = new Audio('/notification-sound.mp3');
              audio.volume = 0.5;
              audio.play().catch(err => {
                console.error('Erro ao tocar notificação:', err);
              });
              console.log('Som de nova solicitação tocado com sucesso!');
            } catch (error) {
              console.error('Erro ao tocar som de nova solicitação:', error);
            }
            
            // Emitir evento de nova atividade para o componente SimpleSoundPlayer (reforço)
            setMessageData({ type: 'sound', soundType: 'new-reprint-request' });
            
            // Notificar usuário sobre nova solicitação de reimpressão
            toast({
              title: 'Nova Solicitação de Reimpressão',
              description: `Uma nova solicitação para reimpressão do pedido "${data.activityTitle}" foi registrada.`,
              variant: 'default',
            });
          }
          
        } catch (parseError) {
          console.error('Erro ao processar mensagem WebSocket:', parseError);
        }
      };
      
      // Manipulador de eventos para quando a conexão for fechada
      socket.onclose = (event) => {
        if (!isMountedRef.current) return;
        
        console.log('WebSocket desconectado, iniciando reconexão inteligente...', event);
        
        // Limpar intervalos de heartbeat
        clearTimers();
        
        // Atualizar estado
        setConnected(false);
        
        // Incrementar contador de erros consecutivos
        consecutiveErrorsRef.current += 1;
        
        // Se estamos tendo muitos erros consecutivos, tentar atualizar via polling mais agressivamente
        if (consecutiveErrorsRef.current >= MAX_CONSECUTIVE_ERRORS) {
          console.log(`${MAX_CONSECUTIVE_ERRORS} erros consecutivos - ativando polling de emergência e pausa no WebSocket`);
          // Forçar atualização de dados via polling como fallback
          refreshDataPeriodically();
          
          // Pausa mais longa antes de tentar reconectar
          reconnectTimeoutRef.current = setTimeout(() => {
            // Resetar contador de erros
            consecutiveErrorsRef.current = 0;
            reconnectAttemptsRef.current = 0;
            reconnectDelayRef.current = INITIAL_RECONNECT_DELAY;
            connect();
          }, RECONNECT_PAUSE * 1.5); // Pausa maior para deixar a rede se estabilizar
          
          return;
        }
        
        // Se tivermos atingido o máximo de tentativas, fazer uma pausa maior
        if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
          console.log(`${reconnectAttemptsRef.current} tentativas de reconexão - pausa de ${RECONNECT_PAUSE/1000}s antes de tentar novamente`);
          
          // Forçar atualização de dados via polling como fallback
          refreshDataPeriodically();
          
          // Pausa antes de tentar novamente
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current = 0;
            reconnectDelayRef.current = INITIAL_RECONNECT_DELAY;
            connect();
          }, RECONNECT_PAUSE);
        } else {
          // Caso contrário, tentar novamente com backoff exponencial
          reconnectAttemptsRef.current += 1;
          
          // Adicionar jitter (variação aleatória) para evitar reconexões simultâneas
          const jitter = 1 - JITTER_MAX + (Math.random() * JITTER_MAX * 2);
          
          // Calcular próximo atraso de reconexão (backoff exponencial com jitter)
          const delay = Math.min(
            reconnectDelayRef.current * RECONNECT_BACKOFF_FACTOR * jitter,
            MAX_RECONNECT_DELAY
          );
          
          console.log(`Reconexão inteligente em ${(delay/1000).toFixed(1)} segundos (tentativa ${reconnectAttemptsRef.current} de ${MAX_RECONNECT_ATTEMPTS})...`);
          
          // Atualizar atraso para próxima vez
          reconnectDelayRef.current = delay;
          
          // Agendar reconexão após o atraso calculado
          reconnectTimeoutRef.current = setTimeout(connect, delay);
          
          // Enquanto isso, atualizar dados via polling
          if (consecutiveErrorsRef.current > 1) {
            // Após o segundo erro, começamos a usar polling como fallback
            console.log('Atualizando dados via polling enquanto aguarda reconexão WebSocket...');
            refreshDataPeriodically();
          }
        }
      };
      
      // Manipulador de erros para a conexão WebSocket
      socket.onerror = (event) => {
        if (!isMountedRef.current) return;
        
        console.error('Erro WebSocket detectado, aguardando ciclo normal de reconexão...', event);
        
        // Atualizar estado
        setError('Erro na conexão WebSocket. Tentando reconectar...');
        
        // O onclose será chamado automaticamente após um erro, onde tratamos a reconexão
      };
      
    } catch (error) {
      console.error('Exceção ao configurar WebSocket:', error);
      
      // Agendar reconexão após breve atraso
      reconnectTimeoutRef.current = setTimeout(connect, 2000);
    }
  }, [user, clearTimers, sendHeartbeat, registerWithDepartment, refreshDataPeriodically, toast]);
  
  // Efeito para realizar limpeza ao desmontar o componente
  useEffect(() => {
    return () => {
      // Limpar timers
      clearTimers();
      
      // Fechar conexão WebSocket
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, [clearTimers]);
  
  // Efeito para iniciar a conexão
  useEffect(() => {
    if (user) {
      // Pequeno atraso para garantir que não conectamos antes dos componentes estarem prontos
      const initTimeout = setTimeout(() => {
        connect();
      }, 1000);
      
      return () => clearTimeout(initTimeout);
    }
  }, [user, connect]);
  
  // Reconectar sempre que o usuário mudar
  useEffect(() => {
    if (user) {
      // Se já temos uma conexão aberta com um usuário diferente, reconectar
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        // Reconectar apenas se o departamento/função do usuário mudou
        connect();
      }
    }
  }, [user?.role, connect]);
  
  // Sistema de atualizações periódicas com polling adaptativo turbinado
  useEffect(() => {
    if (!user) return;
    
    // Iniciar com intervalo ultra-curto para primeira atualização instantânea
    let currentInterval = MIN_POLLING_INTERVAL * 0.7; // Começa ainda mais rápido
    
    // Referência para controlar o timeout e o intervalo entre tentativas
    const timeoutRef = { current: null as NodeJS.Timeout | null };
    
    // Cache para evitar atualizações desnecessárias (otimização de desempenho)
    const dataHashRef = useRef<string | null>(null);
    
    // Contador de atualizações sem mudanças para ajuste dinâmico de intervalo
    const noChangeCountRef = useRef(0);
    
    // Tempos de última atualização e tentativas
    const lastSuccessRef = useRef<number>(Date.now());
    
    // Função super-otimizada para polling adaptativo com detecção inteligente de mudanças
    const doPoll = async () => {
      if (!isMountedRef.current) return;
      
      // Verificar tempo desde última atualização 
      const now = Date.now();
      const lastUpdate = lastUpdateRef.current;
      
      // Bloquear atualizações muito frequentes - mas com threshold MUITO menor (1.6s)
      // para garantir reação extremamente rápida quando necessário
      if (lastUpdate && (now - lastUpdate < 1600)) {
        console.log(`Adiando polling - última atualização há apenas ${Math.floor((now - lastUpdate)/1000)}s`);
      } else {
        try {
          // Tempo antes da atualização para medir performance
          const startTime = performance.now();
          
          // Executar atualização
          await refreshDataPeriodically();
          
          // Atualizar timestamp de última atualização bem-sucedida
          lastSuccessRef.current = Date.now();
          
          // Medir tempo de resposta para ajuste dinâmico
          const responseTime = performance.now() - startTime;
          
          // Ajustar dinamicamente o intervalo com base no tempo de resposta
          // Se o servidor responder rápido, podemos fazer polling mais frequente
          if (responseTime < 500) { // Resposta super rápida
            noChangeCountRef.current = 0; // Reset do contador
            currentInterval = Math.max(MIN_POLLING_INTERVAL * 0.85, 3800); // Intervalo menor, mínimo de 3.8s
          } else if (responseTime > 2000) { // Resposta lenta
            // Aumentar intervalo para reduzir carga no servidor
            currentInterval = Math.min(currentInterval * 1.2, MAX_POLLING_INTERVAL);
          }
        } catch (err) {
          console.error('Erro durante polling:', err);
          // Em caso de erro, aumentar levemente o intervalo
          currentInterval = Math.min(currentInterval * 1.1, MAX_POLLING_INTERVAL);
        }
      }
      
      // Calcular próximo intervalo de forma adaptativa
      // Se WebSocket está com problemas, polling super-agressivo
      if (consecutiveErrorsRef.current >= MAX_CONSECUTIVE_ERRORS) {
        // Modo ultra-agressivo: polling muito mais frequente
        currentInterval = MIN_POLLING_INTERVAL * 0.8;
      } else if (consecutiveErrorsRef.current > 0) {
        // Modo agressivo: polling frequente
        currentInterval = MIN_POLLING_INTERVAL;
      } else if (!connected) {
        // WebSocket desconectado, mas sem erros graves: polling normal
        currentInterval = Math.min(currentInterval, MIN_POLLING_INTERVAL * 2);
      } else if (noChangeCountRef.current > 5) {
        // Se não houver mudanças em 5 verificações consecutivas, aumentar intervalo
        currentInterval = Math.min(currentInterval * POLLING_BACKOFF_FACTOR, MAX_POLLING_INTERVAL);
      }
      
      // Garantir que o intervalo esteja dentro dos limites
      currentInterval = Math.max(MIN_POLLING_INTERVAL * 0.7, Math.min(currentInterval, MAX_POLLING_INTERVAL));
      
      // Agendar próxima execução com intervalo ajustado dinamicamente
      if (isMountedRef.current) {
        console.log(`Próximo polling em ${(currentInterval/1000).toFixed(1)}s`);
        timeoutRef.current = setTimeout(doPoll, currentInterval);
      }
    };
    
    // Iniciar polling imediatamente para primeira atualização ultra-rápida
    timeoutRef.current = setTimeout(doPoll, 200); // Começa quase instantaneamente
    
    // Limpeza ao desmontar
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [user, refreshDataPeriodically, connected]);
  
  return {
    connected,
    error,
    messageData,
    sendMessage,
    updateDataFromServer,
    registerWithDepartment,
    reconnect: connect
  };
}