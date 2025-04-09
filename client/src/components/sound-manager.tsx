import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

// Tipos de sons disponíveis
export enum SoundType {
  NEW_ACTIVITY = 'new-activity', 
  RETURN_ALERT = 'return-alert',
  UPDATE = 'update',
  SUCCESS = 'success',
}

// Mapeamento de sons para URLs
const SOUND_URLS: Record<SoundType, string> = {
  [SoundType.NEW_ACTIVITY]: 'https://cdn.pixabay.com/download/audio/2022/03/24/audio_4ae8c404e7.mp3?filename=notification-sound-to-phone-153180.mp3',
  [SoundType.RETURN_ALERT]: 'https://cdn.pixabay.com/download/audio/2021/08/04/audio_c9a498b433.mp3?filename=analog-alarm-clock-154566.mp3',
  [SoundType.UPDATE]: 'https://cdn.pixabay.com/download/audio/2022/03/25/audio_d5fbdb1629.mp3?filename=correct-choice-138515.mp3',
  [SoundType.SUCCESS]: 'https://cdn.pixabay.com/download/audio/2022/03/10/audio_5db56d9e76.mp3?filename=success-1-6297.mp3',
};

// Contexto para o gerenciador de som
type SoundManagerContextType = {
  playSound: (type: SoundType, volume?: number) => void;
  isSoundEnabled: boolean;
  toggleSound: () => void;
};

const SoundManagerContext = createContext<SoundManagerContextType | null>(null);

// Componente de provedor para gerenciar sons
export const SoundManagerProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  // Gerenciar estado de ativação do som
  const [isSoundEnabled, setIsSoundEnabled] = useState(true);
  
  // Referências para elementos de áudio
  const audioRefs = useRef<Record<SoundType, HTMLAudioElement | null>>({
    [SoundType.NEW_ACTIVITY]: null,
    [SoundType.RETURN_ALERT]: null,
    [SoundType.UPDATE]: null,
    [SoundType.SUCCESS]: null,
  });
  
  // Inicializar elementos de áudio ao montar o componente
  useEffect(() => {
    // Pré-carregar todos os sons
    Object.entries(SOUND_URLS).forEach(([type, url]) => {
      const soundType = type as SoundType;
      const audio = new Audio(url);
      audio.preload = 'auto';
      audioRefs.current[soundType] = audio;
    });
    
    // Limpar ao desmontar
    return () => {
      // Parar e liberar todos os elementos de áudio
      Object.values(audioRefs.current).forEach(audio => {
        if (audio) {
          audio.pause();
          audio.src = '';
        }
      });
    };
  }, []);
  
  // Função para reproduzir um som específico
  const playSound = useCallback((type: SoundType, volume = 0.5) => {
    if (!isSoundEnabled) return;
    
    const audio = audioRefs.current[type];
    if (audio) {
      try {
        // Definir volume e reiniciar
        audio.volume = volume;
        audio.currentTime = 0;
        
        // Tentar reproduzir com tratamento de erros específicos
        const playPromise = audio.play();
        
        // Tratar promessa de reprodução
        if (playPromise !== undefined) {
          playPromise.catch(error => {
            console.warn(`Erro ao reproduzir som ${type}:`, error.message);
            
            // Caso de interação não detectada - comum em navegadores móveis
            if (error.name === 'NotAllowedError') {
              console.info('Reprodução de áudio requer interação do usuário. Aguardando próxima interação.');
            }
          });
        }
      } catch (error) {
        console.error(`Erro ao tentar reproduzir som ${type}:`, error);
      }
    }
  }, [isSoundEnabled]);
  
  // Alternar ativação/desativação do som
  const toggleSound = useCallback(() => {
    setIsSoundEnabled(prev => !prev);
  }, []);
  
  return (
    <SoundManagerContext.Provider
      value={{
        playSound,
        isSoundEnabled,
        toggleSound,
      }}
    >
      {/* Componentes invisíveis de áudio para uso sem interação */}
      {Object.entries(SOUND_URLS).map(([type, url]) => (
        <audio 
          key={type} 
          src={url} 
          preload="auto" 
          style={{ display: 'none' }} 
        />
      ))}
      {children}
    </SoundManagerContext.Provider>
  );
};

// Hook para usar o gerenciador de som
export const useSoundManager = () => {
  const context = useContext(SoundManagerContext);
  if (!context) {
    throw new Error('useSoundManager deve ser usado dentro de um SoundManagerProvider');
  }
  return context;
};

// Botão para alternar som ligado/desligado
export const SoundToggleButton: React.FC = () => {
  const { isSoundEnabled, toggleSound } = useSoundManager();
  
  return (
    <button 
      onClick={toggleSound}
      className="flex items-center justify-center p-2 text-sm font-medium transition-colors bg-transparent border rounded-md hover:bg-muted border-input"
    >
      {isSoundEnabled ? (
        <>
          <span className="mr-2">🔊</span>
          <span>Som Ligado</span>
        </>
      ) : (
        <>
          <span className="mr-2">🔇</span>
          <span>Som Desligado</span>
        </>
      )}
    </button>
  );
};

// Botão para testar som
export const SoundTestButton: React.FC = () => {
  const { playSound } = useSoundManager();
  
  const handleClick = useCallback(() => {
    // Reproduzir som em sequência para testar
    playSound(SoundType.NEW_ACTIVITY);
    setTimeout(() => playSound(SoundType.RETURN_ALERT), 1000);
    setTimeout(() => playSound(SoundType.UPDATE), 2000);
    setTimeout(() => playSound(SoundType.SUCCESS), 3000);
  }, [playSound]);
  
  return (
    <button 
      onClick={handleClick}
      className="flex items-center justify-center p-2 text-sm font-medium transition-colors bg-blue-100 border rounded-md hover:bg-blue-200 border-blue-300 text-blue-700"
    >
      <span className="mr-2">🔊</span>
      <span>Testar Sons</span>
    </button>
  );
};