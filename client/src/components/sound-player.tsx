import { useEffect, useRef } from 'react';

// Tipos de sons disponíveis para notificações
export type SoundType = 'notification' | 'alert' | 'success';

interface SoundPlayerProps {
  type: SoundType;
  play: boolean;
  onPlay?: () => void;
}

// URLs para os arquivos de som (usando sons nativos do browser como fallback)
const soundUrls: Record<SoundType, string> = {
  notification: 'data:audio/mp3;base64,//uQxAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAAKAAAGhgCFhYWFhYWFhYWFhYWFhYW6urq6urq6urq6urq6urrV1dXV1dXV1dXV1dXV1dXV7u7u7u7u7u7u7u7u7u7u//////////////////////////8AAAA5TEFNRTMuOTlyAc0AAAAAAAAAABSAJAJAQgAAgAAAAoZuYuPXAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//vAxAAABLQDe7QQAAI8gqz3PCAAAAAAACQQCBAgLBAIEBhgYEBA4OD+L/KAgKH9YcH8pz//BAIGgupeNlEfw/iCIfeUBQFn/hQoJLqXjZQ/+H+HjbFoLAWdQXLxtoQCgKAg6J//+KAgKAgKA4oCg+D4oCgL//Dg+Lg+QED+oGVCpVFtbP6ZbMyqTEFNRTMuOTkuNaqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqg==',
  alert: 'data:audio/mp3;base64,//uQxAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAALAAAJQQAvLy8vLy8vLy8vLy8vLy9LS0tLS0tLS0tLS0tLS0tLZmZmZmZmZmZmZmZmZmZmZoCAgICAgICAgICAgICAgICamZmZmZmZmZmZmZmZmZm0tLS0tLS0tLS0tLS0tLS0z8/Pz8/Pz8/Pz8/Pz8/P49/f39/f39/f39/f39/f3/////////////////////////////////8AAAA8TEFNRTMuOTlyBK8AAAAAAAAAAABSIJAJAiYAAAAAAAkAAABCAAAAAAAJQQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
  success: 'data:audio/mp3;base64,//uQxAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAAJAAAGhgBVVVVVVVVVVVVVVVVVVVV2dnZ2dnZ2dnZ2dnZ2dnZ2lpaWlpaWlpaWlpaWlpaWlre3t7e3t7e3t7e3t7e3t9fX19fX19fX19fX19fX1/////////////////////////////////8AAAA5TEFNRTMuOTlyAc0AAAAAAAAAABSAJAJAQgAAgAAABoZXA9eCAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//tQxAAABHwFX7QEACCFoOx3gIAAAAABBo2JR6Q0A9kWRv4gzZdALBxwDT8Mz9yZP5/3zzl//85E28QGTB4YEuHhGf5M/y8IgQyC56MZiGYeEZ/k3///4cICB5+GZ+5N/8+eQIZBo9GM/yZn4R//5cICBcIzEMw8If/yb//zcR//5nY+f//EPn+oKL/1tdyqTEFNRTMuOTkuNaqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq'
};

export const SoundPlayer: React.FC<SoundPlayerProps> = ({
  type,
  play,
  onPlay
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  useEffect(() => {
    if (play && audioRef.current) {
      // Tentativa de tocar o som
      audioRef.current.currentTime = 0;
      const playPromise = audioRef.current.play();
      
      // Tratar a promessa para evitar erros no console
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            if (onPlay) onPlay();
          })
          .catch(error => {
            console.warn('Reprodução de áudio falhou:', error);
          });
      }
    }
  }, [play, onPlay]);
  
  return (
    <audio 
      ref={audioRef}
      src={soundUrls[type]}
      preload="auto"
      style={{ display: 'none' }}
    />
  );
};

// Componente para tocar sons específicos por departamento
interface DepartmentSoundPlayerProps {
  department: string;
  play: boolean;
  onPlay?: () => void;
}

export const DepartmentSoundPlayer: React.FC<DepartmentSoundPlayerProps> = ({
  department,
  play,
  onPlay
}) => {
  // Definir tipos de som diferentes para cada departamento
  // para que os usuários possam distinguir as notificações pelo som
  let soundType: SoundType = 'notification';
  
  switch (department) {
    case 'admin':
      soundType = 'alert';
      break;
    case 'gabarito':
      soundType = 'notification';
      break;
    case 'impressao':
      soundType = 'success';
      break;
    case 'batida':
      soundType = 'notification';
      break;
    case 'costura':
      soundType = 'success';
      break;
    case 'embalagem':
      soundType = 'alert';
      break;
    default:
      soundType = 'notification';
  }
  
  console.log(`[som] Tocando som tipo ${soundType} para o departamento ${department}`);
  return <SoundPlayer type={soundType} play={play} onPlay={onPlay} />;
};

export default SoundPlayer;