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
  
  // Função para reproduzir um som específico - versão modificada para navegadores móveis
  const playSound = useCallback((type: SoundType, volume = 0.5) => {
    if (!isSoundEnabled) return;
    
    try {
      console.log(`Tentando reproduzir som: ${type}`);
      
      // 1. Usar elementos de áudio no DOM que criamos dentro do provider
      const audioElement = document.getElementById(`sound-${type}`) as HTMLAudioElement;
      if (audioElement) {
        audioElement.volume = volume;
        audioElement.currentTime = 0;
        
        // Reproduzir som com tratamento de erro específico para mobile
        const playPromise = audioElement.play();
        
        if (playPromise !== undefined) {
          playPromise.catch(error => {
            console.warn(`Erro ao reproduzir som ${type}:`, error.message);
            
            // Método alternativo se falhar - criar um elemento temporário
            if (error.name === 'NotAllowedError') {
              console.info('Tentando método alternativo para reprodução...');
              
              // Usar um elemento temporário com interação do usuário
              const tempAudio = new Audio(SOUND_URLS[type]);
              tempAudio.volume = volume;
              document.body.appendChild(tempAudio);
              
              // Tentar novamente com este novo elemento
              tempAudio.play().catch(e => {
                console.error('Falha no método alternativo:', e.message);
              }).finally(() => {
                // Remover elemento temporário após reprodução
                setTimeout(() => {
                  if (tempAudio.parentNode) {
                    document.body.removeChild(tempAudio);
                  }
                }, 3000);
              });
            }
          });
        }
      } else {
        // 2. Se o elemento não existir, criar um temporário
        console.log('Elemento de áudio não encontrado, criando temporário');
        const audio = new Audio(SOUND_URLS[type]);
        audio.volume = volume;
        audio.play().catch(e => console.warn('Erro ao reproduzir áudio temporário:', e.message));
      }
    } catch (error) {
      console.error(`Erro ao tentar reproduzir som ${type}:`, error);
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
          id={`sound-${type}`}
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

// Botão para testar som - versão melhorada para mobile
export const SoundTestButton: React.FC = () => {
  const { playSound, isSoundEnabled } = useSoundManager();
  const [isPlaying, setIsPlaying] = useState(false);
  
  const handleClick = useCallback(() => {
    if (!isSoundEnabled) {
      alert("O som está desativado! Clique no botão 'Som Desligado' para ativar.");
      return;
    }
    
    // Definir estado para mostrar feedback
    setIsPlaying(true);
    
    try {
      // Método de reprodução direto para maior compatibilidade com mobile
      const playSoundDirectly = (url: string, volume = 0.5) => {
        const audio = new Audio(url);
        audio.volume = volume;
        
        // Usar evento de interação do usuário para iniciar reprodução
        const playPromise = audio.play();
        
        if (playPromise) {
          playPromise.catch(e => {
            console.warn('Erro ao reproduzir som direto:', e.message);
          });
        }
        
        return audio;
      };
      
      // Reproduzir som em sequência usando método direto
      console.log("Reproduzindo som NEW_ACTIVITY diretamente");
      playSoundDirectly(SOUND_URLS[SoundType.NEW_ACTIVITY], 0.7);
      
      setTimeout(() => {
        console.log("Reproduzindo som RETURN_ALERT diretamente");
        playSoundDirectly(SOUND_URLS[SoundType.RETURN_ALERT], 0.7);
      }, 1000);
      
      setTimeout(() => {
        console.log("Reproduzindo som UPDATE diretamente");
        playSoundDirectly(SOUND_URLS[SoundType.UPDATE], 0.7);
      }, 2000);
      
      setTimeout(() => {
        console.log("Reproduzindo som SUCCESS diretamente");
        playSoundDirectly(SOUND_URLS[SoundType.SUCCESS], 0.7);
        
        // Resetar estado após 3.5 segundos (após o último som)
        setTimeout(() => setIsPlaying(false), 500);
      }, 3000);
    } catch (error) {
      console.error("Erro ao testar sons:", error);
      setIsPlaying(false);
    }
  }, [isSoundEnabled, playSound]);
  
  return (
    <button 
      onClick={handleClick}
      disabled={isPlaying}
      className={`flex items-center justify-center p-2 text-sm font-medium transition-colors ${
        isPlaying 
          ? 'bg-green-100 border-green-300 text-green-700' 
          : 'bg-blue-100 border-blue-300 text-blue-700 hover:bg-blue-200'
      } border rounded-md`}
    >
      <span className="mr-2">{isPlaying ? '🎵' : '🔊'}</span>
      <span>{isPlaying ? 'Reproduzindo...' : 'Testar Sons'}</span>
    </button>
  );
};