import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";

export default function TestPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);
  
  const createTestAdmin = async () => {
    setLoading(true);
    try {
      const response = await apiRequest("POST", "/api/register", {
        username: "admin",
        password: "admin123",
        role: "admin",
        name: "Administrador"
      });
      
      if (response.ok) {
        toast({
          title: "Sucesso",
          description: "Usuário administrador criado com sucesso!",
        });
        setRegistered(true);
      } else {
        const data = await response.json();
        toast({
          title: "Erro",
          description: data.message || "Erro ao criar usuário",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao se comunicar com o servidor",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-neutral-100">
      <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full">
        <h1 className="text-2xl font-bold text-center mb-6">Sistema de Gerenciamento de Produção</h1>
        <p className="text-center text-gray-600 mb-6">
          Bem-vindo ao sistema de gerenciamento de fluxo de trabalho para fábrica de camisas. 
          Este sistema permite o controle completo do processo de produção entre diferentes setores.
        </p>
        
        {!registered ? (
          <div className="text-center">
            <Button 
              onClick={createTestAdmin} 
              disabled={loading}
              className="w-full mb-4"
            >
              {loading ? "Criando..." : "Criar Usuário Administrador"}
            </Button>
            <p className="text-xs text-muted-foreground">
              Clique no botão acima para criar um usuário administrador de teste com as credenciais: admin / admin123
            </p>
          </div>
        ) : (
          <div className="text-center p-4 border rounded-md bg-green-50">
            <p className="font-medium text-green-800 mb-2">Usuário administrador criado!</p>
            <p className="text-sm text-green-700">
              Username: admin <br />
              Senha: admin123
            </p>
          </div>
        )}
      </div>
    </div>
  );
}