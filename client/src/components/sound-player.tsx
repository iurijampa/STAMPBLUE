import React, { useRef, useCallback, forwardRef } from 'react';

type SoundPlayerProps = {
  soundUrl?: string;
};

// Definir a interface de referência
export interface SoundPlayerRef {
  play: () => void;
}

// Componente invisível que reproduz som
const SoundPlayer = forwardRef<SoundPlayerRef, SoundPlayerProps>(({ 
  soundUrl = 'https://cdn.pixabay.com/download/audio/2021/08/04/audio_0625c1539c.mp3?filename=notification-sound-7062.mp3'
}, ref) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Método para reproduzir o som
  const play = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0; // Reiniciar o áudio
      audioRef.current.volume = 0.5; // Volume 50%
      audioRef.current.play().catch(error => {
        // Alguns navegadores bloqueiam a reprodução automática
        console.error('Erro ao reproduzir som de notificação:', error);
      });
    }
  }, []);

  // Expor o método play no componente para chamada externa
  React.useImperativeHandle(ref, () => ({
    play
  }));

  return (
    <audio ref={audioRef} preload="auto" src={soundUrl} />
  );
});

SoundPlayer.displayName = 'SoundPlayer';

export default SoundPlayer;

// Hook personalizado para usar o reprodutor de som
export const useSoundPlayer = () => {
  const playerRef = useRef<SoundPlayerRef | null>(null);

  const setPlayerRef = useCallback((ref: SoundPlayerRef | null) => {
    playerRef.current = ref;
  }, []);

  const playSound = useCallback(() => {
    playerRef.current?.play();
  }, []);

  return {
    SoundPlayerWithRef: useCallback((props: SoundPlayerProps) => (
      <SoundPlayer {...props} ref={setPlayerRef} />
    ), [setPlayerRef]),
    playSound
  };
};