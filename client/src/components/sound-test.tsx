import { useState } from 'react';
import { useSoundManager, SoundType } from '@/components/SoundManagerSimples';
import { Button } from '@/components/ui/button';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';

const SoundTestPage = () => {
  const { playSound, isMuted, toggleMute } = useSoundManager();
  const [lastPlayed, setLastPlayed] = useState<string | null>(null);

  const handlePlaySound = (soundType: SoundType, soundName: string) => {
    playSound(soundType);
    setLastPlayed(soundName);
  };

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle>Teste de Sons</CardTitle>
          <CardDescription>
            Teste os diferentes sons utilizados no sistema
          </CardDescription>
        </CardHeader>
        
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col space-y-4">
            <Button 
              onClick={() => handlePlaySound(SoundType.NEW_ACTIVITY, 'Nova Atividade')}
              variant="outline"
              className="justify-start"
            >
              Tocar Som: Nova Atividade
            </Button>
            
            <Button 
              onClick={() => handlePlaySound(SoundType.RETURN_ALERT, 'Alerta de Retorno')}
              variant="outline"
              className="justify-start"
            >
              Tocar Som: Alerta de Retorno
            </Button>
            
            <Button 
              onClick={() => handlePlaySound(SoundType.UPDATE, 'Atualização')}
              variant="outline"
              className="justify-start"
            >
              Tocar Som: Atualização
            </Button>
            
            <Button 
              onClick={() => handlePlaySound(SoundType.SUCCESS, 'Sucesso')}
              variant="outline"
              className="justify-start"
            >
              Tocar Som: Sucesso
            </Button>
          </div>
          
          <div className="flex flex-col space-y-4">
            <div className="p-4 rounded-md bg-muted">
              <p className="font-medium">Status:</p>
              <p>Som: {isMuted ? 'Desativado' : 'Ativado'}</p>
              {lastPlayed && <p>Último som tocado: {lastPlayed}</p>}
            </div>
            
            <Button onClick={toggleMute} variant="secondary">
              {isMuted ? 'Ativar Sons' : 'Desativar Sons'}
            </Button>
          </div>
        </CardContent>
        
        <CardFooter className="flex justify-between">
          <p className="text-sm text-muted-foreground">
            Os sons são reproduzidos automaticamente durante a operação normal do sistema.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
};

export default SoundTestPage;