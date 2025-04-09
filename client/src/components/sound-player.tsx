import { useEffect, useRef } from 'react';

// Sons disponíveis
const SOUNDS = {
  // Som de notificação chamativo para novos pedidos
  NEW_ACTIVITY: '/notification-sound.mp3',
  // Som de alerta para pedidos retornados
  RETURN_ALERT: '/alert-sound.mp3',
  // Som mais sutil para outras atualizações
  UPDATE: '/update-sound.mp3'
};

export type SoundType = keyof typeof SOUNDS;

interface SoundPlayerProps {
  sound: SoundType;
  play: boolean;
  volume?: number;
  onEnd?: () => void;
}

export function SoundPlayer({ sound, play, volume = 1.0, onEnd }: SoundPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  useEffect(() => {
    // Criar elemento de áudio se ainda não existir
    if (!audioRef.current) {
      audioRef.current = new Audio(SOUNDS[sound]);
      audioRef.current.volume = Math.min(1, Math.max(0, volume)); // Garantir que o volume está entre 0 e 1
      
      if (onEnd) {
        audioRef.current.addEventListener('ended', onEnd);
      }
    }
    
    // Reproduzir o som quando play for true
    if (play && audioRef.current) {
      // Reiniciar a reprodução se já estiver tocando
      audioRef.current.currentTime = 0;
      
      // Reproduzir o som
      audioRef.current.play().catch(err => {
        console.error('Erro ao reproduzir som:', err);
      });
    }
    
    // Limpar na desmontagem
    return () => {
      if (audioRef.current && onEnd) {
        audioRef.current.removeEventListener('ended', onEnd);
      }
    };
  }, [sound, play, volume, onEnd]);
  
  // Este componente não renderiza nada visualmente
  return null;
}

// Hook para facilitar a reprodução de sons em qualquer componente
export function useSoundPlayer() {
  const audioRefs = useRef<Record<SoundType, HTMLAudioElement | null>>({
    NEW_ACTIVITY: null,
    RETURN_ALERT: null,
    UPDATE: null
  });
  
  // Pré-carregar todos os sons para evitar atrasos ao reproduzir
  useEffect(() => {
    // Criar e pré-carregar os elementos de áudio
    Object.entries(SOUNDS).forEach(([key, src]) => {
      const soundType = key as SoundType;
      if (!audioRefs.current[soundType]) {
        const audio = new Audio(src);
        audio.preload = 'auto';
        audioRefs.current[soundType] = audio;
        
        // Iniciar o carregamento do arquivo
        audio.load();
      }
    });
    
    // Limpar na desmontagem
    return () => {
      Object.values(audioRefs.current).forEach(audio => {
        if (audio) {
          audio.pause();
          audio.src = '';
        }
      });
    };
  }, []);
  
  // Função para reproduzir um som específico
  const playSound = (sound: SoundType, volume = 1.0) => {
    const audio = audioRefs.current[sound];
    if (audio) {
      audio.volume = Math.min(1, Math.max(0, volume));
      audio.currentTime = 0;
      audio.play().catch(err => {
        console.error(`Erro ao reproduzir som ${sound}:`, err);
      });
    }
  };
  
  return { playSound };
}