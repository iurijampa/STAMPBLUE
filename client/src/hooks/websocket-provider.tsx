import { createContext, ReactNode, useContext } from 'react';
import { useWebSocket } from './use-websocket';

// Criar o contexto para o WebSocket
type WebSocketContextType = ReturnType<typeof useWebSocket>;

const WebSocketContext = createContext<WebSocketContextType | null>(null);

// Provider para o WebSocket
export function WebSocketProvider({ children }: { children: ReactNode }) {
  const webSocketState = useWebSocket();
  
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