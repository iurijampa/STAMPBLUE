import { useCallback, useEffect, useRef, useState } from 'react';

// Estender o tipo NotificationOptions nativo
interface CustomNotificationOptions {
  title: string;
  body?: string;
  icon?: string;
  badge?: string;
  tag?: string;
  onClick?: () => void;
}

export function useBrowserNotification() {
  const [permission, setPermission] = useState<NotificationPermission | 'default'>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );
  const notificationsRef = useRef<Notification[]>([]);
  const [isSupported, setIsSupported] = useState<boolean>(false);

  // Verificar suporte a notificações
  useEffect(() => {
    setIsSupported(
      typeof window !== 'undefined' && 'Notification' in window
    );
  }, []);

  // Solicitar permissão para notificações
  const requestPermission = useCallback(async () => {
    if (!isSupported) return false;

    try {
      const permission = await Notification.requestPermission();
      setPermission(permission);
      return permission === 'granted';
    } catch (error) {
      console.error('Erro ao solicitar permissão de notificação:', error);
      return false;
    }
  }, [isSupported]);

  // Enviar notificação
  const notify = useCallback(
    (options: CustomNotificationOptions): Notification | null => {
      if (!isSupported || permission !== 'granted') return null;

      try {
        // Fechar notificações anteriores com a mesma tag se existir
        if (options.tag) {
          notificationsRef.current
            .filter(n => n.tag === options.tag)
            .forEach(n => n.close());
        }

        // Criar e exibir a notificação
        const notification = new Notification(options.title, {
          body: options.body,
          icon: options.icon || '/logo-stamp-blue.png', // Ícone padrão
          badge: options.badge,
          tag: options.tag
        });

        // Adicionar manipulador de clique
        if (options.onClick) {
          notification.onclick = () => {
            window.focus();
            options.onClick?.();
            notification.close();
          };
        } else {
          notification.onclick = () => {
            window.focus();
            notification.close();
          };
        }

        // Gerenciar notificações ativas
        notificationsRef.current.push(notification);
        notification.onclose = () => {
          notificationsRef.current = notificationsRef.current.filter(
            n => n !== notification
          );
        };

        return notification;
      } catch (error) {
        console.error('Erro ao exibir notificação:', error);
        return null;
      }
    },
    [isSupported, permission]
  );

  // Limpar notificações na desmontagem do componente
  useEffect(() => {
    return () => {
      notificationsRef.current.forEach(notification => notification.close());
      notificationsRef.current = [];
    };
  }, []);

  return {
    isSupported,
    permission,
    requestPermission,
    notify,
  };
}