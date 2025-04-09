import { useEffect, useRef } from 'react';
import { useWebSocketContext } from '@/hooks/websocket-provider';

// Componente simples que apenas toca sons quando eventos do WebSocket ocorrem
export function SimpleSoundPlayer() {
  // Referências para os elementos de áudio
  const newActivitySoundRef = useRef<HTMLAudioElement | null>(null);
  const returnActivitySoundRef = useRef<HTMLAudioElement | null>(null);
  const updateSoundRef = useRef<HTMLAudioElement | null>(null);
  
  // Obter o contexto do WebSocket
  const { messageData } = useWebSocketContext();
  
  // Criar os elementos de áudio ao montar o componente
  useEffect(() => {
    // Criar elementos de áudio
    newActivitySoundRef.current = new Audio('/notification-sound.mp3');
    returnActivitySoundRef.current = new Audio('/alert-sound.mp3');
    updateSoundRef.current = new Audio('/update-sound.mp3');
    
    // Configurar volume
    if (newActivitySoundRef.current) newActivitySoundRef.current.volume = 0.5;
    if (returnActivitySoundRef.current) returnActivitySoundRef.current.volume = 0.6;
    if (updateSoundRef.current) updateSoundRef.current.volume = 0.4;
    
    // Pré-carregar os sons
    newActivitySoundRef.current?.load();
    returnActivitySoundRef.current?.load();
    updateSoundRef.current?.load();
    
    // Limpar ao desmontar
    return () => {
      newActivitySoundRef.current = null;
      returnActivitySoundRef.current = null;
      updateSoundRef.current = null;
    };
  }, []);
  
  // Tocar os sons com base nos eventos do WebSocket
  useEffect(() => {
    if (!messageData) return;
    
    // Verificar tipo de mensagem para tocar o som apropriado
    if (messageData.type === 'sound') {
      try {
        console.log('TOCANDO SOM:', messageData.soundType);
        
        // Tocar o som apropriado baseado no tipo
        if (messageData.soundType === 'new-activity' && newActivitySoundRef.current) {
          newActivitySoundRef.current.currentTime = 0;
          newActivitySoundRef.current.play().catch(err => {
            console.error('Erro ao tocar som de nova atividade:', err);
          });
        } 
        else if (messageData.soundType === 'return-alert' && returnActivitySoundRef.current) {
          returnActivitySoundRef.current.currentTime = 0;
          returnActivitySoundRef.current.play().catch(err => {
            console.error('Erro ao tocar som de alerta de retorno:', err);
          });
        } 
        else if ((['update', 'success'].includes(messageData.soundType)) && updateSoundRef.current) {
          updateSoundRef.current.currentTime = 0;
          updateSoundRef.current.play().catch(err => {
            console.error('Erro ao tocar som de atualização:', err);
          });
        }
      } catch (error) {
        console.error('Erro ao reproduzir som:', error);
      }
    }
  }, [messageData]);
  
  // Não renderiza nada, apenas gerencia sons
  return null;
}

export default SimpleSoundPlayer;