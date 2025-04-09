import React, { createContext, useCallback, useContext, useRef, useState } from 'react';

// Enumeração para tipos de som 
export enum SoundType {
  NEW_ACTIVITY = 'new-activity', 
  RETURN_ALERT = 'return-alert',
  UPDATE = 'update',
  SUCCESS = 'success',
}

// Mapeamento de tipos de som para frequências - mais eficiente
const SOUND_CONFIGS = {
  [SoundType.NEW_ACTIVITY]: { frequency: 880, duration: 150, volume: 0.3 },
  [SoundType.RETURN_ALERT]: { frequency: 330, duration: 200, volume: 0.4 },
  [SoundType.UPDATE]: { frequency: 660, duration: 100, volume: 0.3 },
  [SoundType.SUCCESS]: { frequency: 440, duration: 100, volume: 0.3 }
};

// Contexto de áudio compartilhado para evitar criação constante
let sharedAudioContext: AudioContext | null = null;

// Função para obter o contexto de áudio compartilhado
const getSharedAudioContext = () => {
  if (sharedAudioContext === null || sharedAudioContext.state === 'closed') {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      sharedAudioContext = new AudioContext();
    } catch (e) {
      // Silenciosamente falhar, sem logar erros na console
      return null;
    }
  }
  return sharedAudioContext;
};

// Função otimizada para reproduzir um beep simples
const playBeep = (frequency = 440, duration = 100, volume = 0.3) => {
  try {
    const audioContext = getSharedAudioContext();
    if (!audioContext) return false;
    
    // Criar oscilador para gerar som
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    // Configurar oscilador para som tipo "beep" - mais curto
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    
    // Configurar volume mais baixo para não ser intrusivo
    gainNode.gain.value = volume;
    
    // Conectar nós de áudio
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Iniciar oscilador
    oscillator.start();
    
    // Parar após duração especificada - mais curta para melhor desempenho
    setTimeout(() => {
      oscillator.stop();
      
      // Não fechar o contexto compartilhado após cada uso
      // Isso evita sobrecarga de criação/destruição de contextos
    }, duration);
    
    return true;
  } catch (error) {
    // Silenciosamente falhar
    return false;
  }
};

// Contexto para o gerenciador de som
type SoundManagerContextType = {
  playSound: (type: SoundType) => void;
  isSoundEnabled: boolean;
  toggleSound: () => void;
  isMuted: boolean;
  toggleMute: () => void;
};

const SoundManagerContext = createContext<SoundManagerContextType | null>(null);

// Componente de provedor para gerenciar sons - otimizado
export const SoundManagerProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  // Configuração de som persistente via localStorage
  const [isSoundEnabled, setIsSoundEnabled] = useState(() => {
    return localStorage.getItem('soundEnabled') !== 'false'; // Padrão: true
  });
  const [isMuted, setIsMuted] = useState(false);
  
  // Cache de timestamps para evitar tocar sons muito próximos (anti-spam)
  const lastPlayedRef = useRef<Record<SoundType, number>>({} as Record<SoundType, number>);
  
  // Função simplificada e otimizada para reproduzir som
  const playSound = useCallback((type: SoundType) => {
    if (!isSoundEnabled || isMuted) return;
    
    // Evitar spam de sons - intervalo mínimo de 300ms entre sons do mesmo tipo
    const now = Date.now();
    const lastPlayed = lastPlayedRef.current[type] || 0;
    if (now - lastPlayed < 300) return;
    
    lastPlayedRef.current[type] = now;
    
    // Obter configuração para o tipo de som
    const config = SOUND_CONFIGS[type] || SOUND_CONFIGS[SoundType.NEW_ACTIVITY];
    
    // Tocar som
    if (type === SoundType.SUCCESS) {
      // Caso especial para som de sucesso (dois tons)
      playBeep(440, 100, 0.3);
      setTimeout(() => playBeep(660, 100, 0.3), 150);
    } else {
      playBeep(config.frequency, config.duration, config.volume);
    }
  }, [isSoundEnabled, isMuted]);
  
  // Alternar ativação/desativação do som com persistência
  const toggleSound = useCallback(() => {
    setIsSoundEnabled(prev => {
      const newValue = !prev;
      // Persistir configuração no localStorage
      localStorage.setItem('soundEnabled', newValue.toString());
      
      // Tocar um beep de confirmação se estiver ativando o som
      if (newValue) {
        setTimeout(() => playBeep(880, 100, 0.2), 50);
      }
      
      return newValue;
    });
  }, []);
  
  // Alternar mudo/não-mudo (temporário, sem persistência)
  const toggleMute = useCallback(() => {
    setIsMuted(prev => !prev);
  }, []);
  
  return (
    <SoundManagerContext.Provider
      value={{
        playSound,
        isSoundEnabled,
        toggleSound,
        isMuted,
        toggleMute
      }}
    >
      {children}
    </SoundManagerContext.Provider>
  );
};

// Hook otimizado para usar o gerenciador de som
export const useSoundManager = () => {
  const context = useContext(SoundManagerContext);
  if (!context) {
    throw new Error('useSoundManager deve ser usado dentro de um SoundManagerProvider');
  }
  return context;
};

// Botão compacto para alternar som ligado/desligado
export const SoundToggleButton: React.FC = () => {
  const { isSoundEnabled, toggleSound } = useSoundManager();
  
  return (
    <button 
      onClick={toggleSound}
      className="flex items-center justify-center p-2 text-sm font-medium transition-colors bg-transparent border rounded-md hover:bg-slate-100 border-input"
    >
      {isSoundEnabled ? "🔊" : "🔇"}
    </button>
  );
};

// Botão simples para testar um som específico - otimizado
export const SoundTestSingleButton: React.FC<{ type: SoundType; label: string }> = ({ type, label }) => {
  const { playSound, isSoundEnabled } = useSoundManager();
  const [isPlaying, setIsPlaying] = useState(false);
  
  const handleClick = useCallback(() => {
    if (!isSoundEnabled) {
      alert("Som desativado");
      return;
    }
    
    setIsPlaying(true);
    playSound(type);
    
    // Resetar estado após um pequeno atraso
    setTimeout(() => setIsPlaying(false), 300);
  }, [type, playSound, isSoundEnabled]);
  
  return (
    <button 
      onClick={handleClick}
      disabled={isPlaying}
      className={`flex items-center justify-center p-2 mr-2 text-sm font-medium transition-colors ${
        isPlaying 
          ? 'bg-green-100 border-green-300 text-green-700' 
          : 'bg-blue-100 border-blue-300 text-blue-700 hover:bg-blue-200'
      } border rounded-md`}
    >
      <span>{isPlaying ? '🎵' : '🔊'}</span>
    </button>
  );
};

// Botão compacto para testar todos os sons - otimizado
export const SoundTestButton: React.FC = () => {
  const { isSoundEnabled } = useSoundManager();
  
  if (!isSoundEnabled) {
    return (
      <button 
        onClick={() => alert("Som desativado")}
        className="flex items-center justify-center p-2 text-sm font-medium transition-colors bg-red-100 border rounded-md hover:bg-red-200 border-red-300 text-red-700"
      >
        <span>🔇</span>
      </button>
    );
  }
  
  return (
    <div className="flex flex-wrap gap-2 items-center">
      <SoundTestSingleButton type={SoundType.NEW_ACTIVITY} label="Novo" />
      <SoundTestSingleButton type={SoundType.RETURN_ALERT} label="Retorno" />
      <SoundTestSingleButton type={SoundType.SUCCESS} label="Sucesso" />
    </div>
  );
};