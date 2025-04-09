import { useEffect, useRef, useState } from 'react';
import { useWebSocketContext } from '@/hooks/websocket-provider';
import { Button } from "@/components/ui/button";

// Componente para botão de permissão de áudio - aparece fixo na tela
export function AudioPermissionButton() {
  const [granted, setGranted] = useState(() => {
    return localStorage.getItem('soundPermissionGranted') === 'true';
  });
  
  // Função para solicitar permissão de áudio - otimizada
  const requestPermission = () => {
    try {
      // Tentar criar um AudioContext (mais compatível com mobile)
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContext) {
        const context = new AudioContext();
        
        // Marcar permissão como concedida imediatamente
        localStorage.setItem('soundPermissionGranted', 'true');
        setGranted(true);
        
        // Tocar um beep curto apenas para confirmar que o som funciona
        const oscillator = context.createOscillator();
        oscillator.connect(context.destination);
        oscillator.frequency.value = 440; // Nota A, mais amigável
        oscillator.start();
        
        // Parar o som rapidamente e liberar recursos
        setTimeout(() => {
          oscillator.stop();
          context.close();
        }, 150);
        
        // Exibir confirmação visual ao usuário
        console.log("✅ Permissão de áudio concedida!");
      }
    } catch (error) {
      console.error("Erro ao solicitar permissão de áudio:", error);
    }
  };
  
  // Não mostrar nada se já tem permissão
  if (granted) return null;
  
  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Button
        onClick={requestPermission}
        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white animate-pulse"
      >
        <span>🔊</span>
        <span>Ativar Notificações Sonoras</span>
      </Button>
    </div>
  );
}

// Componente responsável por ouvir os eventos do WebSocket e tocar os sons correspondentes
export default function SimpleSoundPlayer() {
  // Cache de áudio para evitar recarregar os mesmos sons
  const audioCache = useRef<Record<string, HTMLAudioElement>>({});
  const { messageData } = useWebSocketContext();
  
  // Função para verificar permissão de áudio
  const checkAudioPermission = () => {
    return localStorage.getItem('soundPermissionGranted') === 'true';
  };
  
  // Inicialização do componente - otimizada para carregar sons apenas uma vez
  useEffect(() => {
    // Pré-carregar sons para melhor desempenho
    const preloadSounds = () => {
      // Lista de sons que serão pré-carregados
      const sounds = {
        'notification': '/notification-sound.mp3',
        'alert': '/alert-sound.mp3',
        'update': '/update-sound.mp3'
      };
      
      // Carregar cada som no cache
      Object.entries(sounds).forEach(([key, path]) => {
        const audio = new Audio();
        audio.src = path;
        audio.load(); // Carregar o som sem reproduzir
        audioCache.current[key] = audio;
      });
    };
    
    // Tentar pré-carregar sons
    try {
      preloadSounds();
    } catch (e) {
      console.warn("Não foi possível pré-carregar sons:", e);
    }
    
    // Versão minimalista da função global para compatibilidade
    (window as any).tocarSomTeste = (tipo: string) => {
      playSound(tipo);
    };
    
    // Versão MODO DEUS simplificada - usa osciladores diretamente
    (window as any).modoDeusSom = (tipo: string) => {
      try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContext) return false;
        
        const context = new AudioContext();
        const oscillator = context.createOscillator();
        oscillator.frequency.value = tipo === 'new-activity' ? 880 : 440;
        oscillator.connect(context.destination);
        
        oscillator.start();
        setTimeout(() => {
          oscillator.stop();
          context.close();
        }, 150);
        
        return true;
      } catch (e) {
        return false;
      }
    };
    
    return () => {
      // Limpar cache e remover funções globais
      audioCache.current = {};
      delete (window as any).tocarSomTeste;
      delete (window as any).modoDeusSom;
    };
  }, []);
  
  // Tocar um som específico - otimizado para desempenho
  const playSound = (type: string) => {
    if (!checkAudioPermission()) return;
    
    try {
      // Mapear tipo para chave de som
      let soundKey = 'notification';
      
      switch (type) {
        case 'new-activity': 
          soundKey = 'notification';
          break;
        case 'return-alert': 
          soundKey = 'alert';
          break;
        case 'update':
        case 'success': 
          soundKey = 'update';
          break;
      }
      
      // Usar som do cache se disponível, ou criar novo
      const sound = audioCache.current[soundKey] || new Audio(`/${soundKey}-sound.mp3`);
      sound.volume = 0.3; // Volume mais baixo para não ser intrusivo
      
      // Reproduzir o som
      sound.currentTime = 0; // Reiniciar o som para poder ser tocado novamente
      sound.play().catch(() => {
        // Plano B: usar oscilador (funciona mesmo quando o navegador bloqueia áudio)
        try {
          const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
          if (AudioContext) {
            const context = new AudioContext();
            const oscillator = context.createOscillator();
            oscillator.type = 'sine';
            oscillator.frequency.value = type === 'new-activity' ? 880 : 440;
            oscillator.connect(context.destination);
            oscillator.start();
            setTimeout(() => {
              oscillator.stop();
              context.close();
            }, 150);
          }
        } catch (e) {
          // Silenciosamente falhar
        }
      });
    } catch (error) {
      // Silenciosamente falhar - não logar erros para reduzir ruído na console
    }
  };
  
  // Responder aos eventos do WebSocket - simplificado
  useEffect(() => {
    if (!messageData) return;
    
    if (messageData.type === 'sound' && messageData.soundType !== 'check_activities') {
      playSound(messageData.soundType);
    }
    
    // Não precisamos de mais logs para atualização de dados
  }, [messageData]);
  
  // Renderiza apenas o botão de permissão
  return <AudioPermissionButton />;
}