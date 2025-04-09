import { useEffect } from 'react';
import { useWebSocketContext } from '@/hooks/websocket-provider';
import { useSoundManager, SoundType } from '@/components/SoundManagerSimples';

/**
 * Componente responsável por fazer a ponte entre o WebSocket e o Sistema de Som
 * Não renderiza nada, apenas escuta os eventos do WebSocket e reproduz sons correspondentes
 */
export function WebSocketSoundBridge() {
  const { messageData } = useWebSocketContext();
  const { playSound } = useSoundManager();

  // Efeito para escutar as mensagens de som e reproduzir o som correspondente
  useEffect(() => {
    if (!messageData || messageData.type !== 'sound') return;

    console.log('WebSocketSoundBridge: Reproduzindo som:', messageData.soundType);
    
    try {
      switch (messageData.soundType) {
        case 'new-activity':
          playSound(SoundType.NEW_ACTIVITY);
          break;
        case 'return-alert':
          playSound(SoundType.RETURN_ALERT);
          break;
        case 'update':
          playSound(SoundType.UPDATE);
          break;
        case 'success':
          playSound(SoundType.SUCCESS);
          break;
        default:
          console.warn('Tipo de som desconhecido:', messageData.soundType);
      }
    } catch (error) {
      console.error('Erro ao reproduzir som:', error);
    }
  }, [messageData, playSound]);

  // Este componente não renderiza nada
  return null;
}