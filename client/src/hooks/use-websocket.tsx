import { useAuth } from './use-auth';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useToast } from './use-toast';
import { queryClient } from '@/lib/queryClient';

export function useWebSocket() {
  const { user } = useAuth();
  const socketRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  
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
  
  // Conectar ao WebSocket
  useEffect(() => {
    if (!user) return;
    
    const connect = () => {
      try {
        // Definir o protocolo com base no protocolo do site
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        
        // Criar nova conexão WebSocket
        const socket = new WebSocket(wsUrl);
        socketRef.current = socket;
        
        // Manipulador de eventos para quando a conexão for aberta
        socket.onopen = () => {
          console.log('WebSocket conectado com sucesso!');
          setConnected(true);
          setError(null);
          
          // Registrar-se com o departamento do usuário
          registerWithDepartment(user.role);
        };
        
        // Manipulador de eventos para mensagens recebidas
        socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
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
              queryClient.invalidateQueries({ queryKey: ['/api/activities'] });
              
              // Notificar usuário sobre nova atividade
              toast({
                title: 'Novo Pedido Recebido',
                description: `O pedido "${data.activity.title}" está disponível para seu setor.`,
                variant: 'default',
              });
            } 
            else if (data.type === 'activity_returned') {
              // Invalidar cache para atualizar lista de atividades
              queryClient.invalidateQueries({ queryKey: ['/api/activities'] });
              
              // Notificar usuário sobre pedido retornado
              toast({
                title: 'Pedido Retornado',
                description: `O pedido "${data.activity.title}" foi retornado por ${data.returnedBy || 'alguém'} do setor ${data.from}.`,
                variant: 'destructive',
              });
            } 
            else if (data.type === 'activity_returned_update' || data.type === 'activity_completed') {
              // Apenas invalidar cache para atualizar lista de atividades
              queryClient.invalidateQueries({ queryKey: ['/api/activities'] });
            } 
            else if (data.type === 'activity_progress') {
              // Invalidar cache para atualizar lista de atividades e progresso
              queryClient.invalidateQueries({ queryKey: ['/api/activities'] });
              queryClient.invalidateQueries({ queryKey: ['/api/activities/progress'] });
              queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
              
              // Notificar admins sobre o progresso de atividades
              if (user.role === 'admin') {
                if (data.isCompleted) {
                  toast({
                    title: 'Produção Concluída',
                    description: `O pedido "${data.activity.title}" foi finalizado por ${data.completedBy} no setor ${data.department}.`,
                    variant: 'default',
                  });
                } else {
                  toast({
                    title: 'Pedido Avançou',
                    description: `Pedido "${data.activity.title}" passou de ${data.department} para ${data.nextDepartment}.`,
                    variant: 'default',
                  });
                }
              }
            }
          } catch (err) {
            console.error('Erro ao processar mensagem WebSocket:', err);
          }
        };
        
        // Manipulador de eventos para erros
        socket.onerror = (event) => {
          console.error('Erro WebSocket:', event);
          setError('Ocorreu um erro na conexão.');
          setConnected(false);
        };
        
        // Manipulador de eventos para fechamento da conexão
        socket.onclose = (event) => {
          console.log('WebSocket desconectado:', event);
          setConnected(false);
          
          // Tentar reconectar após 5 segundos em caso de desconexão
          if (user) {
            setTimeout(() => {
              connect();
            }, 5000);
          }
        };
      } catch (err) {
        console.error('Erro ao configurar WebSocket:', err);
        setError('Não foi possível estabelecer conexão.');
        setConnected(false);
      }
    };
    
    connect();
    
    // Função de limpeza para fechar a conexão quando o componente for desmontado
    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [user, registerWithDepartment, toast]);
  
  return {
    connected,
    error,
    sendMessage,
    registerWithDepartment
  };
}