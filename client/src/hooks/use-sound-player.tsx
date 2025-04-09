import { useCallback, useState, useRef } from 'react';
import { 
  SoundPlayer, 
  DepartmentSoundPlayer, 
  SoundType 
} from '@/components/sound-player';

export const useSoundPlayer = () => {
  const [soundToPlay, setSoundToPlay] = useState<SoundType | null>(null);
  const [playing, setPlaying] = useState(false);
  const departmentRef = useRef<string | null>(null);
  const departmentPlayingRef = useRef(false);

  // Função para tocar um som específico
  const playSound = useCallback((type: SoundType, volume = 1.0) => {
    // Se estiver tocando, não faça nada
    if (playing) return;
    
    // Configurar o volume (não implementado aqui, mas poderia ser adicionado)
    // Tocar o som
    setSoundToPlay(type);
    setPlaying(true);
  }, [playing]);

  // Função para tocar um som específico para o departamento
  const playDepartmentSound = useCallback((department: string) => {
    // Se estiver tocando, não faça nada
    if (departmentPlayingRef.current) return;
    
    // Configurar departamento e tocar
    departmentRef.current = department;
    departmentPlayingRef.current = true;
    
    console.log(`[som] Tocando notificação para o departamento: ${department}`);
  }, []);

  // Função chamada quando o som termina
  const handleSoundEnd = useCallback(() => {
    setPlaying(false);
    setSoundToPlay(null);
  }, []);

  // Função chamada quando o som do departamento termina
  const handleDepartmentSoundEnd = useCallback(() => {
    departmentPlayingRef.current = false;
    departmentRef.current = null;
  }, []);

  return {
    playSound,
    playDepartmentSound,
    soundComponent: (
      <>
        {soundToPlay && (
          <SoundPlayer 
            type={soundToPlay} 
            play={playing} 
            onPlay={handleSoundEnd} 
          />
        )}
        {departmentRef.current && (
          <DepartmentSoundPlayer 
            department={departmentRef.current} 
            play={departmentPlayingRef.current} 
            onPlay={handleDepartmentSoundEnd} 
          />
        )}
      </>
    )
  };
};

export default useSoundPlayer;