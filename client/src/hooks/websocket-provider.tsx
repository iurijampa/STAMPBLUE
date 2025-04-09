import { createContext, ReactNode, useContext } from 'react';
import { useWebSocket } from './use-websocket';
import { useSoundPlayer } from './use-sound-player';

// Criar o contexto para o WebSocket
type WebSocketContextType = ReturnType<typeof useWebSocket>;

const WebSocketContext = createContext<WebSocketContextType | null>(null);

// Provider para o WebSocket
export function WebSocketProvider({ children }: { children: ReactNode }) {
  const webSocketState = useWebSocket();
  const { soundComponent } = useSoundPlayer();
  
  return (
    <WebSocketContext.Provider value={webSocketState}>
      {soundComponent}
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