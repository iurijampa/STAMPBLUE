import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { User } from "@shared/schema";
import { Loader2 } from "lucide-react";

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
    <div className="min-h-screen p-8">
      <div className="max-w-5xl mx-auto bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Página de Teste</h1>
          <div className="flex items-center gap-4">
            <p className="text-sm text-muted-foreground">
              Usuário: <span className="font-semibold">{user?.name || user?.username}</span>
            </p>
            <Button variant="outline" onClick={handleLogout}>
              Sair
            </Button>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 border border-border">
          <h2 className="text-xl font-bold mb-4">Informações do Usuário</h2>
          <pre className="bg-slate-100 p-4 rounded-md overflow-auto">
            {JSON.stringify(user, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}