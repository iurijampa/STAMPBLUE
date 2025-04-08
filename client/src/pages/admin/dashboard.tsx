import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import { User } from "@shared/schema";

export default function AdminDashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Verificar se o usuário está autenticado
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
          
          // Verificar se o usuário é admin
          if (userData.role !== "admin") {
            navigate("/department/dashboard");
          }
        }
      } catch (err) {
        console.error("Erro ao verificar autenticação:", err);
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

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-5xl mx-auto bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Dashboard do Administrador</h1>
          <div className="flex items-center gap-4">
            <p className="text-sm text-muted-foreground">
              Bem-vindo, <span className="font-semibold">{user?.name || user?.username}</span>
            </p>
            <Button variant="outline" onClick={handleLogout}>
              Sair
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-primary-50 rounded-lg p-4 border border-primary-200">
            <h2 className="text-lg font-semibold mb-2">Atividades Pendentes</h2>
            <p className="text-3xl font-bold">0</p>
          </div>
          <div className="bg-primary-50 rounded-lg p-4 border border-primary-200">
            <h2 className="text-lg font-semibold mb-2">Em Progresso</h2>
            <p className="text-3xl font-bold">0</p>
          </div>
          <div className="bg-primary-50 rounded-lg p-4 border border-primary-200">
            <h2 className="text-lg font-semibold mb-2">Concluídas</h2>
            <p className="text-3xl font-bold">0</p>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 border border-border">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Atividades Recentes</h2>
            <Button>Nova Atividade</Button>
          </div>
          <div className="text-center py-8 text-muted-foreground">
            Nenhuma atividade encontrada.
          </div>
        </div>
      </div>
    </div>
  );
}