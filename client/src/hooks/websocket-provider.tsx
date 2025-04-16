import { createContext, ReactNode, useContext, useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from './use-auth';
import { useToast } from './use-toast';
import { queryClient } from '@/lib/queryClient';

// CONFIGURAÇÃO TURBO-OTIMIZADA 3.0 SIMPLIFICADA
// Configurações principais
const MIN_POLLING_INTERVAL = 4000; // 4 segundos - atualizações ultra-frequentes
const MAX_POLLING_INTERVAL = 15000; // 15 segundos - intervalo máximo
const RECONNECT_DELAY = 3000; // 3 segundos - reconexão rápida
const WS_TIMEOUT = 5000; // 5 segundos - timeout de conexão

// Interface mais simples para o contexto WebSocket
interface WebSocketContextType {
  connected: boolean;
  sendMessage: (data: any) => void;
  departmentListeners: Set<string>;
  addDepartmentListener: (department: string) => void;
  removeDepartmentListener: (department: string) => void;
}

// Criar o contexto para o WebSocket
const WebSocketContext = createContext<WebSocketContextType | null>(null);

// Interface para a Window global com a função playSoundAlert
declare global {
  interface Window {
    playSoundAlert?: () => void;
  }
}

// Provider para o WebSocket
export function WebSocketProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [connected, setConnected] = useState(false);
  const [departmentListeners] = useState<Set<string>>(new Set());
  
  // Refs para gerenciar recursos
  const socketRef = useRef<WebSocket | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Função para adicionar um departamento para ouvir
  const addDepartmentListener = useCallback((department: string) => {
    if (departmentListeners.has(department)) return;
    departmentListeners.add(department);
  }, [departmentListeners]);
  
  // Função para remover um departamento para ouvir
  const removeDepartmentListener = useCallback((department: string) => {
    if (departmentListeners.has(department)) {
      departmentListeners.delete(department);
    }
  }, [departmentListeners]);
  
  // Função para limpar recursos
  const cleanup = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    if (socketRef.current) {
      try {
        socketRef.current.close();
      } catch (e) {
        // Ignorar erros ao fechar
      }
      socketRef.current = null;
    }
  }, []);
  
  // Função para enviar uma mensagem através do WebSocket
  const sendMessage = useCallback((data: any) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      try {
        socketRef.current.send(JSON.stringify(data));
      } catch (err) {
        console.error('Erro ao enviar mensagem via WebSocket:', err);
      }
    }
  }, []);
  
  // Função para buscar dados via polling
  const fetchData = useCallback(async () => {
    if (!user) return;
    
    try {
      // Buscar dados com base no papel do usuário
      if (user.role === 'admin') {
        const response = await fetch('/api/activities', { 
          credentials: 'include',
          headers: { 'Cache-Control': 'no-cache' }
        });
        
        if (response.ok) {
          const data = await response.json();
          queryClient.setQueryData(['/api/activities'], data);
        }
      } else {
        const response = await fetch(`/api/activities/department/${user.role}`, {
          credentials: 'include',
          headers: { 'Cache-Control': 'no-cache' }
        });
        
        if (response.ok) {
          const data = await response.json();
          queryClient.setQueryData(['/api/department/activities', user.role], data);
        }
      }
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
    }
  }, [user]);
  
  // Função para conectar ao WebSocket
  const connectWebSocket = useCallback(() => {
    if (!user || socketRef.current) return;
    
    cleanup();
    
    try {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      
      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;
      
      // Configurar timeout de conexão
      timeoutRef.current = setTimeout(() => {
        if (socket.readyState !== WebSocket.OPEN) {
          socket.close();
          socketRef.current = null;
          // Tentar reconectar
          timeoutRef.current = setTimeout(connectWebSocket, RECONNECT_DELAY);
        }
      }, WS_TIMEOUT);
      
      socket.onopen = () => {
        console.log('WebSocket conectado com sucesso!');
        setConnected(true);
        
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        
        // Enviar autenticação
        if (user) {
          sendMessage({
            type: 'auth',
            userId: user.id,
            username: user.username,
            role: user.role
          });
        }
        
        // Iniciar polling para garantir dados atualizados
        fetchData();
        intervalRef.current = setInterval(fetchData, MIN_POLLING_INTERVAL);
      };
      
      socket.onclose = () => {
        console.log('WebSocket fechado');
        setConnected(false);
        socketRef.current = null;
        
        // Tentar reconectar
        timeoutRef.current = setTimeout(connectWebSocket, RECONNECT_DELAY);
      };
      
      socket.onerror = () => {
        console.error('Erro no WebSocket');
        socket.close();
      };
      
      socket.onmessage = (event) => {
        try {
          console.time('⚡ [WS] Processamento de mensagem WebSocket');
          const data = JSON.parse(event.data);
          
          // Verificar se a mensagem é de alta prioridade
          const isHighPriority = data._turbo === true || data.system_priority === 'maximum';
          
          if (isHighPriority) {
            console.log('🔥 [TURBO] MENSAGEM DE ALTA PRIORIDADE RECEBIDA!', data.type);
          }
          
          if (data.type === 'notification') {
            // Notificação recebida - PRIORIDADE ALTA
            toast({
              title: isHighPriority ? `⚠️ ${data.title || 'Nova notificação'}` : data.title || 'Nova notificação',
              description: data.message,
              variant: data.variant || 'default',
              duration: isHighPriority ? 10000 : 5000
            });
            
            // TURBO: Atualizar cache IMEDIATAMENTE para todas as queries relevantes
            if (data.refreshQueries && Array.isArray(data.refreshQueries)) {
              console.log('🔄 [TURBO] Atualizando queries após notificação WebSocket:', data.refreshQueries);
              data.refreshQueries.forEach((queryKey: string | string[]) => {
                queryClient.invalidateQueries({ 
                  queryKey: typeof queryKey === 'string' ? [queryKey] : queryKey,
                  // Forçar refetch para garantir dados atualizados
                  refetchType: 'active',
                });
              });
              
              // ULTRA: Também atualizar stats e contadores para garantir UI consistente
              queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
              queryClient.invalidateQueries({ queryKey: ['/api/stats/department-counts'] });
              
              // DEUS: Invalidar ainda mais queries para alta prioridade
              if (isHighPriority) {
                queryClient.invalidateQueries({ 
                  queryKey: ['/api/activities'],
                  refetchType: 'active',
                });
                queryClient.invalidateQueries({ 
                  queryKey: ['/api/activities/returned'],
                  refetchType: 'active',
                });
              }
            }
            
            // MODO DEUS: Reproduzir som para departamento específico com múltiplas tentativas
            if (data.department && departmentListeners.has(data.department)) {
              console.log(`🔔 [TURBO] Reproduzindo som para departamento: ${data.department}${isHighPriority ? ' (URGENTE)' : ''}`);
              
              // Estratégia 1: Usar função global
              if (window.playSoundAlert) {
                try {
                  window.playSoundAlert();
                  
                  // Segunda tentativa para prioridade alta
                  if (isHighPriority) {
                    setTimeout(() => {
                      try {
                        window.playSoundAlert?.();
                      } catch (e) {
                        console.error('Erro na segunda tentativa de som global:', e);
                      }
                    }, 500);
                  }
                } catch (e) {
                  console.error('Erro ao reproduzir som global:', e);
                }
              }
              
              // Estratégia 2: Audio API direta como fallback
              try {
                const audio = new Audio(isHighPriority ? '/alert-sound.mp3' : '/notification-sound.mp3');
                audio.volume = isHighPriority ? 0.7 : 0.5;
                audio.play().catch(err => {
                  console.error('Erro ao tocar som de notificação fallback:', err);
                });
              } catch (error) {
                console.error('Erro ao tocar som fallback:', error);
              }
            }
            
          } else if (data.type === 'data_update') {
            console.time('⚡ [TURBO] Processamento de atualização de dados');
            
            // TURBO: Invalidar cache IMEDIATAMENTE
            console.log(`🚀 [TURBO] Recebida atualização de dados ${isHighPriority ? 'CRÍTICA' : 'importante'}! Processando...`);
            queryClient.invalidateQueries({ 
              queryKey: data.queryKey || ['/api/activities'],
              // Forçar refetch para garantir dados atualizados
              refetchType: 'active',
            });
            
            // ULTRA: Também atualizar stats e contadores para garantir UI consistente
            queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
            queryClient.invalidateQueries({ queryKey: ['/api/stats/department-counts'] });
            
            // DEUS: Invalidar ainda mais queries para alta prioridade
            if (isHighPriority) {
              queryClient.invalidateQueries({ 
                queryKey: ['/api/activities/returned'],
                refetchType: 'active',
              });
              // Se prioridade máxima, atualizar TODAS as consultas
              if (data.system_priority === 'maximum') {
                console.log('🔥 [TURBO] PRIORIDADE MÁXIMA - ATUALIZANDO TODAS AS CONSULTAS!');
                queryClient.invalidateQueries();
              }
            }
            
            // MODO DEUS: Reproduzir som com alta prioridade
            if (data.department && departmentListeners.has(data.department)) {
              console.log(`🔔 [TURBO] Reproduzindo som para departamento: ${data.department}${isHighPriority ? ' (URGENTE)' : ''}`);
              
              // Estratégia 1: Usar função global
              if (window.playSoundAlert) {
                try {
                  window.playSoundAlert();
                  
                  // Segunda tentativa para prioridade alta
                  if (isHighPriority) {
                    setTimeout(() => {
                      try {
                        window.playSoundAlert?.();
                      } catch (e) {
                        console.error('Erro na segunda tentativa de som global:', e);
                      }
                    }, 500);
                  }
                } catch (e) {
                  console.error('Erro ao reproduzir som global:', e);
                }
              }
              
              // Estratégia 2: Audio API direta como fallback
              try {
                const soundFile = isHighPriority ? '/alert-sound.mp3' : '/notification-sound.mp3';
                const audio = new Audio(soundFile);
                audio.volume = isHighPriority ? 0.7 : 0.5;
                
                audio.play().catch(err => {
                  console.error('Erro ao tocar som de notificação fallback:', err);
                  
                  // Segunda tentativa com delay
                  setTimeout(() => {
                    try {
                      const backupAudio = new Audio(soundFile);
                      backupAudio.volume = isHighPriority ? 0.8 : 0.6; // Volume ainda maior na segunda tentativa
                      backupAudio.play().catch(e => console.error('Erro na segunda tentativa de som:', e));
                    } catch (e) {
                      console.error('Erro na criação do backup de áudio:', e);
                    }
                  }, 300);
                });
              } catch (error) {
                console.error('Erro ao tocar som fallback:', error);
              }
            }
            
            // Atualizar dados imediatamente com polling agressivo
            fetchData();
            console.timeEnd('⚡ [TURBO] Processamento de atualização de dados');
          }
        } catch (err) {
          console.error('Erro ao processar mensagem:', err);
        }
      };
    } catch (err) {
      console.error('Erro ao configurar WebSocket:', err);
      
      // Tentar reconectar
      timeoutRef.current = setTimeout(connectWebSocket, RECONNECT_DELAY);
    }
  }, [user, cleanup, sendMessage, fetchData, departmentListeners, toast]);
  
  // Efeito para conectar/desconectar o WebSocket
  useEffect(() => {
    if (user) {
      connectWebSocket();
    } else {
      cleanup();
    }
    
    return cleanup;
  }, [user, connectWebSocket, cleanup]);
  
  const webSocketState: WebSocketContextType = {
    connected,
    sendMessage,
    departmentListeners,
    addDepartmentListener,
    removeDepartmentListener
  };
  
  return (
    <WebSocketContext.Provider value={webSocketState}>
      {children}
    </WebSocketContext.Provider>
  );
}

// Hook para acessar o contexto do WebSocket
export function useWebSocketContext() {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocketContext deve ser usado dentro de um WebSocketProvider');
  }
  return context;
}