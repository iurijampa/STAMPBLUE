import React, { createContext, useCallback, useContext, useState } from 'react';

// Enumeração para tipos de som
export enum SoundType {
  NEW_ACTIVITY = 'new-activity', 
  RETURN_ALERT = 'return-alert',
  UPDATE = 'update',
  SUCCESS = 'success',
}

// Função para criar sons usando a API Web Audio (mais compatível com dispositivos móveis)
const createAudioContext = () => {
  try {
    // Usar AudioContext para maior compatibilidade
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    return new AudioContext();
  } catch (e) {
    console.error("Web Audio API não suportada neste navegador", e);
    return null;
  }
};

// Função para reproduzir um beep simples
const playBeep = (frequency = 440, duration = 300, volume = 0.5) => {
  try {
    const audioContext = createAudioContext();
    if (!audioContext) return;
    
    // Criar oscilador para gerar som
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    // Configurar oscilador para som tipo "beep"
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    
    // Configurar volume
    gainNode.gain.value = volume;
    
    // Conectar nós de áudio
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Iniciar oscilador
    oscillator.start();
    
    // Parar após duração especificada
    setTimeout(() => {
      oscillator.stop();
      // Fechar contexto após uso para liberar recursos
      setTimeout(() => {
        if (audioContext.state !== 'closed') {
          audioContext.close();
        }
      }, 100);
    }, duration);
    
    return true;
  } catch (error) {
    console.error("Erro ao reproduzir beep:", error);
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

// Componente de provedor para gerenciar sons
export const SoundManagerProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  // Gerenciar estado de ativação do som
  const [isSoundEnabled, setIsSoundEnabled] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  
  // Função simplificada para reproduzir som
  const playSound = useCallback((type: SoundType) => {
    if (!isSoundEnabled || isMuted) return;
    
    console.log(`Tentando reproduzir som: ${type}`);
    
    try {
      switch (type) {
        case SoundType.NEW_ACTIVITY:
          // Tom agudo para novidades
          return playBeep(880, 300, 0.3);
        case SoundType.RETURN_ALERT:
          // Tom mais grave para alertas
          return playBeep(330, 500, 0.5);
        case SoundType.UPDATE:
          // Tom médio para atualizações
          return playBeep(660, 200, 0.3);
        case SoundType.SUCCESS:
          // Dois tons ascendentes para sucesso
          playBeep(440, 150, 0.3);
          setTimeout(() => playBeep(660, 200, 0.3), 200);
          return true;
        default:
          return playBeep(440, 300, 0.3);
      }
    } catch (error) {
      console.error(`Erro ao reproduzir som ${type}:`, error);
      return false;
    }
  }, [isSoundEnabled, isMuted]);
  
  // Alternar ativação/desativação do som (configuração global)
  const toggleSound = useCallback(() => {
    setIsSoundEnabled(prev => {
      // Tocar um beep confirmando ativação
      if (!prev) {
        setTimeout(() => playBeep(880, 100, 0.2), 100);
      }
      return !prev;
    });
  }, []);
  
  // Alternar mudo/não-mudo (configuração temporária)
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

// Botão simples para testar um som específico
export const SoundTestSingleButton: React.FC<{ type: SoundType; label: string }> = ({ type, label }) => {
  const { playSound, isSoundEnabled } = useSoundManager();
  const [isPlaying, setIsPlaying] = useState(false);
  
  const handleClick = useCallback(() => {
    if (!isSoundEnabled) {
      alert("O som está desativado! Clique no botão 'Som Desligado' para ativar.");
      return;
    }
    
    setIsPlaying(true);
    playSound(type);
    
    // Resetar estado após um pequeno atraso
    setTimeout(() => setIsPlaying(false), 500);
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
      <span className="mr-2">{isPlaying ? '🎵' : '🔊'}</span>
      <span>{isPlaying ? 'Tocando...' : label}</span>
    </button>
  );
};

// Botão para testar todos os sons
export const SoundTestButton: React.FC = () => {
  const { isSoundEnabled } = useSoundManager();
  
  if (!isSoundEnabled) {
    return (
      <button 
        onClick={() => alert("O som está desativado! Clique no botão 'Som Desligado' para ativar.")}
        className="flex items-center justify-center p-2 text-sm font-medium transition-colors bg-red-100 border rounded-md hover:bg-red-200 border-red-300 text-red-700"
      >
        <span className="mr-2">🔇</span>
        <span>Som Desativado</span>
      </button>
    );
  }
  
  return (
    <div className="flex flex-wrap gap-2 items-center">
      <SoundTestSingleButton type={SoundType.NEW_ACTIVITY} label="Novo Pedido" />
      <SoundTestSingleButton type={SoundType.RETURN_ALERT} label="Retorno" />
      <SoundTestSingleButton type={SoundType.UPDATE} label="Atualização" />
      <SoundTestSingleButton type={SoundType.SUCCESS} label="Sucesso" />
    </div>
  );
};