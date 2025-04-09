import SoundTestPage from '@/components/sound-test';
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { User } from "@shared/schema";
import { Loader2, Menu, LogOut } from "lucide-react";

export default function TestPage() {
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [, navigate] = useLocation();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/user', {
          credentials: 'include'
        });
        
        if (response.status === 401) {
          navigate("/auth");
          return;
        }
        
        if (response.ok) {
          const userData = await response.json();
          setUser(userData);
        } else {
          navigate("/auth");
        }
      } catch (err) {
        console.error("Erro ao verificar autenticação:", err);
        navigate("/auth");
      } finally {
        setIsLoading(false);
      }
    };
    
    checkAuth();
  }, [navigate]);
  
  const handleLogout = async () => {
    try {
      const response = await fetch('/api/logout', {
        method: 'POST',
        credentials: 'include',
      });
      
      if (response.ok) {
        toast({
          title: "Logout realizado com sucesso",
        });
        navigate("/auth");
      } else {
        throw new Error('Falha ao fazer logout');
      }
    } catch (error) {
      console.error("Erro ao fazer logout:", error);
      toast({
        title: "Falha no logout",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin mr-2" />
        <p>Carregando...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      {/* Barra superior com informações do usuário */}
      <div className="flex justify-between items-center mb-6 p-3 bg-background shadow rounded-lg">
        <div className="flex items-center gap-2">
          <Menu className="h-5 w-5 text-muted-foreground" />
          <span className="font-medium">Teste de Sons</span>
        </div>
        {user && (
          <div className="flex items-center gap-4">
            <div className="text-sm text-right">
              <div className="font-medium">{user.username}</div>
              <div className="text-muted-foreground capitalize">{user.role}</div>
            </div>
            <Button variant="ghost" size="icon" onClick={handleLogout} title="Sair">
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        )}
      </div>

      {/* Título da página */}
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight mb-2">
            Teste de Sons do Sistema
          </h1>
          <p className="text-muted-foreground">
            Use esta página para testar os sons utilizados no sistema de notificações.
          </p>
        </div>

        {/* Componente de teste de sons */}
        <SoundTestPage />
        
        {/* Rodapé estilizado */}
        <div className="text-center text-xs text-muted-foreground mt-8 italic">
          Desenvolvido por Iuri
        </div>
      </div>
    </div>
  );
}