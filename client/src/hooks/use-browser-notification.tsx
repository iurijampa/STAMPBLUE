import { useCallback, useEffect, useState } from 'react';
import { useSoundPlayer } from '@/components/sound-player';

interface NotificationOptions {
  title: string;
  body?: string;
  icon?: string;
  playSound?: boolean;
  customSound?: string;
}

export const useBrowserNotification = () => {
  const [permission, setPermission] = useState<NotificationPermission | null>(null);
  const { SoundPlayerWithRef, playSound } = useSoundPlayer();

  // Solicitar permissão para enviar notificações
  const requestPermission = useCallback(async () => {
    try {
      if (!('Notification' in window)) {
        console.warn('Este navegador não suporta notificações do sistema');
        return false;
      }

      if (Notification.permission === 'granted') {
        setPermission('granted');
        return true;
      }

      if (Notification.permission !== 'denied') {
        const newPermission = await Notification.requestPermission();
        setPermission(newPermission);
        return newPermission === 'granted';
      }

      setPermission('denied');
      return false;
    } catch (error) {
      console.error('Erro ao solicitar permissão para notificações:', error);
      return false;
    }
  }, []);

  // Enviar notificação
  const sendNotification = useCallback(
    ({ title, body, icon, playSound: shouldPlaySound = true, customSound }: NotificationOptions) => {
      try {
        // Se não tivermos permissão, apenas tocamos o som se solicitado
        if (permission !== 'granted') {
          if (shouldPlaySound) {
            playSound();
          }
          return null;
        }

        // Se tivermos permissão, enviamos a notificação completa
        const notification = new Notification(title, {
          body,
          icon: icon || '/favicon.ico',
          silent: !shouldPlaySound, // Se não for tocar som, silenciar a notificação nativa
        });

        // Reproduzir som personalizado se solicitado
        if (shouldPlaySound) {
          playSound();
        }

        return notification;
      } catch (error) {
        console.error('Erro ao enviar notificação:', error);
        // Se falhar, pelo menos tocamos o som
        if (shouldPlaySound) {
          playSound();
        }
        return null;
      }
    },
    [permission, playSound]
  );

  // Verificar permissão na montagem
  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  return {
    permission,
    requestPermission,
    sendNotification,
    SoundPlayerWithRef,
    playSound,
  };
};