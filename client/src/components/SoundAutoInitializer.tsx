import { useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";

/**
 * Componente especial que solicita permissão de áudio assim que a página carrega
 * Este componente deve ser importado e usado no App.tsx uma única vez
 */
export default function SoundAutoInitializer() {
  const { toast } = useToast();

  // Solicitar permissão de áudio automaticamente ao carregar
  useEffect(() => {
    // Aguardar um momento para garantir que o navegador está pronto
    const timeoutId = setTimeout(() => {
      try {
        // Verificar se já temos permissão
        if (localStorage.getItem('soundPermissionGranted') === 'true') {
          console.log("✅ Permissão de áudio já concedida anteriormente");
          return;
        }

        console.log("🔊 Solicitando permissão de áudio automaticamente...");

        // Criar contexto de áudio silencioso para obter permissão
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContext) {
          console.error("API Web Audio não suportada neste navegador");
          return;
        }

        const context = new AudioContext();
        const oscillator = context.createOscillator();
        const gainNode = context.createGain();

        // Volume zero para ser completamente silencioso
        gainNode.gain.value = 0;

        oscillator.connect(gainNode);
        gainNode.connect(context.destination);

        // Reproduzir som silencioso brevemente
        oscillator.start();

        setTimeout(() => {
          oscillator.stop();
          context.close();

          // Salvar permissão no localStorage
          localStorage.setItem('soundPermissionGranted', 'true');
          
          // Mostrar toast informativo
          toast({
            title: "Sistema de notificações ativado",
            description: "Você receberá alertas sonoros quando novos pedidos chegarem.",
            variant: "default",
          });
          
          console.log("✅ Permissão de áudio concedida automaticamente");
        }, 100);
      } catch (error) {
        console.error("Erro ao solicitar permissão de áudio:", error);
      }
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [toast]);

  return null; // Este componente não renderiza nada
}