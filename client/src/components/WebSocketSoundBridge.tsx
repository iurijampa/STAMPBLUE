import { useEffect, useRef } from 'react';
import { useWebSocketContext } from '@/hooks/websocket-provider';
import { useSoundManager, SoundType } from '@/components/SoundManagerSimples';

// Mapeamento de tipos de mensagem para tipos de som - otimizado
const SOUND_TYPE_MAP: Record<string, SoundType> = {
  'new-activity': SoundType.NEW_ACTIVITY,
  'return-alert': SoundType.RETURN_ALERT,
  'update': SoundType.UPDATE,
  'success': SoundType.SUCCESS
};

/**
 * Componente otimizado responsável por fazer a ponte entre o WebSocket e o Sistema de Som
 * Não renderiza nada, apenas escuta os eventos e reproduz sons de maneira eficiente
 */
export function WebSocketSoundBridge() {
  const { messageData } = useWebSocketContext();
  const { playSound } = useSoundManager();
  
  // Referência para controlar o tempo entre sons - evitar spam
  const lastPlayedRef = useRef<Record<string, number>>({});
  
  // Efeito otimizado para processar mensagens de som
  useEffect(() => {
    // Ignorar mensagens que não são de som
    if (!messageData || messageData.type !== 'sound') return;
    
    // Ignorar mensagens para verificar atividades (não produzem som)
    if (messageData.soundType === 'check_activities') return;
    
    // Tempo mínimo entre sons do mesmo tipo (300ms)
    const now = Date.now();
    const soundType = messageData.soundType;
    const lastPlayed = lastPlayedRef.current[soundType] || 0;
    
    // Se o som foi tocado recentemente, ignorar
    if (now - lastPlayed < 300) return;
    
    // Mapear o tipo de mensagem para o tipo de som
    const mappedSoundType = SOUND_TYPE_MAP[soundType];
    
    // Se o tipo de som for conhecido, reproduzir
    if (mappedSoundType) {
      // Registrar o tempo de reprodução para evitar spam
      lastPlayedRef.current[soundType] = now;
      
      // Tocar o som (sem try/catch para melhorar desempenho)
      playSound(mappedSoundType);
    }
  }, [messageData, playSound]);

  // Este componente não renderiza nada - otimizado
  return null;
}