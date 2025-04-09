import { useCallback, useEffect, useRef } from 'react';

interface NotificationSoundOptions {
  volume?: number;
  soundUrl?: string;
}

/**
 * Hook para reproduzir som de notificação
 */
export const useNotificationSound = ({
  volume = 0.5,
  soundUrl = 'https://cdn.pixabay.com/download/audio/2021/08/04/audio_0625c1539c.mp3?filename=notification-sound-7062.mp3'
}: NotificationSoundOptions = {}) => {
  // Referência para elemento de áudio
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  // Criar o elemento de áudio ao montar o componente
  useEffect(() => {
    // Criar elemento de áudio
    const audio = new Audio(soundUrl);
    audio.volume = volume;
    audio.preload = 'auto';
    audioRef.current = audio;
    
    // Limpeza ao desmontar
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [soundUrl, volume]);
  
  // Função para reproduzir o som com parâmetros opcionais
  const playSound = useCallback(() => {
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
  }, []);
  
  return { playSound };
};

/**
 * Hook para notificações do navegador com som
 */
export const useBrowserNotification = () => {
  // Checar se o navegador suporta notificações
  const hasSupport = ('Notification' in window);
  
  // Referência para reproduzir som de notificação
  const { playSound } = useNotificationSound();
  
  // Função para solicitar permissão de notificação
  const requestPermission = useCallback(async () => {
    if (!hasSupport) return false;
    
    try {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    } catch (error) {
      console.error('Erro ao solicitar permissão para notificações:', error);
      return false;
    }
  }, [hasSupport]);
  
  // Função para enviar notificação
  const sendNotification = useCallback((title: string, options?: {
    body?: string;
    icon?: string;
    silent?: boolean;
    withSound?: boolean;
  }) => {
    if (!hasSupport) return null;
    
    try {
      // Verificar se temos permissão
      if (Notification.permission !== 'granted') {
        return null;
      }
      
      // Reproduzir som se necessário
      if (options?.withSound !== false) {
        playSound();
      }
      
      // Criar e retornar notificação
      return new Notification(title, {
        body: options?.body,
        icon: options?.icon,
        silent: options?.silent
      });
    } catch (error) {
      console.error('Erro ao enviar notificação:', error);
      return null;
    }
  }, [hasSupport, playSound]);
  
  return {
    hasSupport,
    requestPermission,
    sendNotification,
    playSound
  };
};