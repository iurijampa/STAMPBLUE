import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Volume2, ChevronDown, ChevronUp } from 'lucide-react';
import { useSoundPlayer, SoundType } from './sound-player';

export default function SoundTest() {
  const [isOpen, setIsOpen] = useState(false);
  const { playSound } = useSoundPlayer();
  
  const sounds: { name: string; type: SoundType; description: string }[] = [
    { 
      name: 'Notificação de Novo Pedido', 
      type: 'NEW_ACTIVITY',
      description: 'Som tocado quando um novo pedido é criado ou chega ao seu setor'
    },
    { 
      name: 'Alerta de Pedido Retornado', 
      type: 'RETURN_ALERT',
      description: 'Som tocado quando um pedido é retornado por outro setor'
    },
    { 
      name: 'Atualização de Status', 
      type: 'UPDATE',
      description: 'Som tocado quando há atualizações no sistema'
    }
  ];
  
  return (
    <Card className="mt-6 border shadow-sm">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="py-4 cursor-pointer hover:bg-muted/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Volume2 className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Teste de Sons</CardTitle>
              </div>
              {isOpen ? (
                <ChevronUp className="h-5 w-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <CardDescription>
              Teste os sons do sistema de notificações
            </CardDescription>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="pt-0 pb-4">
            <div className="grid grid-cols-1 gap-3">
              {sounds.map((sound) => (
                <div key={sound.type} className="flex items-center justify-between border rounded-lg p-3">
                  <div>
                    <h3 className="font-medium">{sound.name}</h3>
                    <p className="text-sm text-muted-foreground">{sound.description}</p>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => playSound(sound.type, 1.0)}
                    className="flex items-center gap-1.5"
                  >
                    <Volume2 className="h-4 w-4" />
                    Testar
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}