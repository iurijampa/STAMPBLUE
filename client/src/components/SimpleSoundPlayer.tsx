import { useEffect, useRef, useState } from 'react';
import { useWebSocketContext } from '@/hooks/websocket-provider';
import { Button } from "@/components/ui/button";

// Componente para botão de permissão de áudio - aparece fixo na tela
export function AudioPermissionButton() {
  const [granted, setGranted] = useState(() => {
    return localStorage.getItem('soundPermissionGranted') === 'true';
  });
  
  // Função para solicitar permissão de áudio explicitamente
  const requestPermission = () => {
    try {
      // Criar contexto de áudio temporário e tocar som de teste
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContext) {
        const context = new AudioContext();
        const oscillator = context.createOscillator();
        const gainNode = context.createGain();
        
        oscillator.type = 'sine';
        oscillator.frequency.value = 440; // Nota A, 440Hz
        gainNode.gain.value = 0.1; // Volume baixo
        
        oscillator.connect(gainNode);
        gainNode.connect(context.destination);
        
        // Tocar som muito breve
        oscillator.start();
        setTimeout(() => {
          oscillator.stop();
          setTimeout(() => context.close(), 100);
          
          // Marcar permissão como concedida
          localStorage.setItem('soundPermissionGranted', 'true');
          setGranted(true);
          console.log("🔊 Permissão de áudio concedida!");
          
          // Tocar um som de teste para confirmar
          const testSound = new Audio();
          testSound.src = '/notification-sound.mp3';
          testSound.volume = 0.3;
          testSound.play().catch(e => console.error("Ainda sem permissão:", e));
          
        }, 200);
      }
    } catch (error) {
      console.error("Erro ao solicitar permissão de áudio:", error);
    }
  };
  
  // Não mostrar nada (nem mesmo o botão flutuante)
  // pois já temos botão de ativação específico em cada dashboard
  return null;
}

// Componente responsável por ouvir os eventos do WebSocket e tocar os sons correspondentes
export default function SimpleSoundPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { messageData } = useWebSocketContext();
  
  // Função para verificar permissão de áudio
  const checkAudioPermission = () => {
    return localStorage.getItem('soundPermissionGranted') === 'true';
  };
  
  // Inicialização do componente
  useEffect(() => {
    // Criar elemento de áudio oculto (isso ajuda em alguns navegadores)
    audioRef.current = new Audio();
    audioRef.current.volume = 0.5;
    
    // Função global para tocar sons diretamente
    (window as any).tocarSomTeste = (tipo: string) => {
      console.log(`Solicitação para tocar som de teste: ${tipo}`);
      playSound(tipo);
    };
    
    // Função global MODO DEUS que ignora todas as verificações de permissão
    (window as any).modoDeusSom = (tipo: string) => {
      console.log(`🔊 MODO DEUS: Tocando som ${tipo} diretamente`);
      try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContext) {
          console.error("API Web Audio não suportada");
          return false;
        }
        
        const context = new AudioContext();
        const oscillator = context.createOscillator();
        const gainNode = context.createGain();
        
        // Configurações de som diferentes para cada tipo
        switch (tipo) {
          case 'new-activity':
            oscillator.frequency.value = 880; // Tom mais alto
            gainNode.gain.value = 0.3;
            break;
          case 'return-alert':
            oscillator.frequency.value = 330; // Tom mais grave
            gainNode.gain.value = 0.4;
            break;
          default:
            oscillator.frequency.value = 440; // Tom médio
            gainNode.gain.value = 0.3;
        }
        
        oscillator.type = 'sine';
        oscillator.connect(gainNode);
        gainNode.connect(context.destination);
        
        oscillator.start();
        setTimeout(() => {
          oscillator.stop();
          setTimeout(() => context.close(), 100);
        }, 300);
        
        return true;
      } catch (e) {
        console.error("MODO DEUS FALHOU:", e);
        return false;
      }
    };
    
    return () => {
      audioRef.current = null;
      // Remover funções globais
      delete (window as any).tocarSomTeste;
      delete (window as any).modoDeusSom;
    };
  }, []);
  
  // Tocar um som específico
  const playSound = (type: string) => {
    // Retornar silenciosamente se não temos permissão
    if (!checkAudioPermission()) {
      console.log("⚠️ Sem permissão para reproduzir áudio. O usuário precisa interagir primeiro.");
      return;
    }
    
    try {
      // Selecionar arquivo de som de acordo com o tipo
      let soundPath = '';
      
      switch (type) {
        case 'new-activity':
          soundPath = '/notification-sound.mp3';
          console.log("🔔 Tocando som de nova atividade");
          break;
        case 'return-alert':
          soundPath = '/alert-sound.mp3';
          console.log("⚠️ Tocando som de alerta de retorno");
          break;
        case 'update':
        case 'success':
          soundPath = '/update-sound.mp3';
          console.log("✅ Tocando som de atualização/sucesso");
          break;
        default:
          // Usar som padrão para outros tipos
          soundPath = '/notification-sound.mp3';
          console.log(`🔔 Tocando som padrão para tipo: ${type}`);
      }
      
      // Método alternativo #1 - Criar novo elemento de áudio a cada vez
      const sound = new Audio(soundPath);
      sound.volume = 0.5;
      
      // Método que funciona mais amplamente em dispositivos móveis
      sound.play().catch(err => {
        console.error('Erro ao reproduzir som:', err);
        
        // Última tentativa - chamar função global
        try {
          if ((window as any).playSoundAlert) {
            (window as any).playSoundAlert(type);
          }
        } catch (e) {
          console.error('Falha total ao tentar reproduzir som:', e);
        }
      });
      
    } catch (error) {
      console.error('Erro ao tentar reproduzir som:', error);
    }
  };
  
  // Responder aos eventos do WebSocket
  useEffect(() => {
    if (!messageData) return;
    
    if (messageData.type === 'sound') {
      playSound(messageData.soundType);
    }
  }, [messageData]);
  
  // Renderiza o botão de permissão de áudio
  return <AudioPermissionButton />;
}