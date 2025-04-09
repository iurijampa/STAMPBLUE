import { useEffect, useRef } from 'react';

/**
 * Hook simples para notificações sonoras
 * @returns uma função para reproduzir o som de notificação
 */
export const useSoundNotification = () => {
  // Referência para elemento de áudio
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  // Criar o elemento de áudio ao montar o componente
  useEffect(() => {
    // URL do som de notificação (som de notificação gratuito e leve)
    const soundUrl = 'https://cdn.pixabay.com/download/audio/2021/08/04/audio_0625c1539c.mp3?filename=notification-sound-7062.mp3';
    
    // Criar elemento de áudio
    const audio = new Audio(soundUrl);
    audio.volume = 0.5;
    audio.preload = 'auto';
    audioRef.current = audio;
    
    // Limpeza ao desmontar
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);
  
  // Função para reproduzir o som
  const playNotificationSound = () => {
    if (audioRef.current) {
      try {
        // Reiniciar o som para garantir que ele toque novamente
        audioRef.current.currentTime = 0;
        
        // Reproduzir o som
        audioRef.current.play().catch(error => {
          console.error('Erro ao reproduzir som de notificação:', error);
        });
      } catch (error) {
        console.error('Erro ao tentar reproduzir som:', error);
      }
    }
  };
  
  return playNotificationSound;
};