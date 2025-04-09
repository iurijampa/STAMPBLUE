import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';

// Componente que toca som quando o usuário interage com a página
export function SoundTestToque() {
  const [permissionGranted, setPermissionGranted] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  // Inicializar o áudio
  useEffect(() => {
    // Criar elemento de áudio
    audioRef.current = new Audio('/notification-sound.mp3');
    
    // Tentar pré-carregar o som
    audioRef.current.load();
    
    // Verificar se o som pode ser reproduzido automaticamente
    let attemptAutoplay = async () => {
      try {
        await audioRef.current?.play();
        // Se chegar aqui, o navegador permitiu autoplay
        audioRef.current?.pause();
        audioRef.current!.currentTime = 0;
        setPermissionGranted(true);
        // Armazenar a permissão no localStorage
        localStorage.setItem('soundPermissionGranted', 'true');
        console.log("✅ Permissão para som concedida automaticamente");
      } catch (error) {
        // Autoplay não permitido, precisará de interação do usuário
        console.log("❌ Permissão para som negada, necessário clicar no botão");
        setPermissionGranted(false);
      }
    };
    
    // Verificar se já temos permissão no localStorage
    if (localStorage.getItem('soundPermissionGranted') === 'true') {
      setPermissionGranted(true);
      console.log("✅ Permissão para som já havia sido concedida anteriormente");
    } else {
      attemptAutoplay();
    }
    
    return () => {
      // Limpar referência do áudio
      audioRef.current = null;
    };
  }, []);
  
  // Função para tocar o som e garantir permissão
  const handleEnableSounds = () => {
    try {
      audioRef.current?.play();
      setPermissionGranted(true);
      // Armazenar a permissão no localStorage
      localStorage.setItem('soundPermissionGranted', 'true');
      console.log("✅ Permissão para som concedida pelo usuário");
    } catch (error) {
      console.error("Erro ao habilitar sons:", error);
    }
  };
  
  // Injetar elementos globais no window
  useEffect(() => {
    if (permissionGranted) {
      // Criar uma função global que pode ser chamada de qualquer lugar
      (window as any).playSoundAlert = (soundType: string) => {
        const audio = new Audio(
          soundType === 'notification' ? '/notification-sound.mp3' : 
          soundType === 'alert' ? '/alert-sound.mp3' : 
          '/update-sound.mp3'
        );
        
        audio.volume = 0.5;
        audio.play().catch(err => {
          console.error('Erro ao tocar som:', err);
        });
        
        console.log(`Som tocado: ${soundType}`);
      };
      
      console.log("✅ Sistema de som global configurado - window.playSoundAlert() disponível");
    }
  }, [permissionGranted]);
  
  // Mostrar botão somente se não tivermos permissão
  if (!permissionGranted) {
    return (
      <div className="fixed bottom-4 right-4 z-50 bg-primary/10 p-3 rounded-lg shadow-lg border border-primary/30">
        <Button 
          variant="default" 
          className="pulse-animation"
          onClick={handleEnableSounds}
        >
          Ativar Notificações Sonoras
        </Button>
      </div>
    );
  }
  
  // Se já temos permissão, não renderiza nada
  return null;
}

export default SoundTestToque;