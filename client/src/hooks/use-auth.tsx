import { createContext, useContext, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { User as SelectUser, InsertUser } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

// Tipo para os dados de login
type LoginData = {
  username: string;
  password: string;
};

// Interface do contexto de autenticação
interface AuthContextType {
  user: SelectUser | null;
  isLoading: boolean;
  error: Error | null;
  login: (data: LoginData) => Promise<SelectUser>;
  register: (data: InsertUser) => Promise<SelectUser>;
  logout: () => Promise<void>;
  logoutMutation: {
    mutate: () => void;
    isPending: boolean;
  };
}

// Criando o contexto de autenticação
const AuthContext = createContext<AuthContextType | null>(null);

// Provider component
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SelectUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Buscar o usuário atual
  useEffect(() => {
    const fetchUser = async () => {
      setIsLoading(true);
      try {
        const response = await fetch('/api/user', {
          credentials: 'include'
        });
        
        if (response.status === 401) {
          setUser(null);
          return;
        }
        
        if (!response.ok) {
          throw new Error(`Error: ${response.status}`);
        }
        
        const userData = await response.json();
        setUser(userData);
        queryClient.setQueryData(['/api/user'], userData);
      } catch (err) {
        console.error("Error fetching user:", err);
        setError(err instanceof Error ? err : new Error("Erro desconhecido"));
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUser();
  }, [queryClient]);
  
  // Login function
  const login = async (data: LoginData): Promise<SelectUser> => {
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Falha no login. Por favor, verifique suas credenciais.');
      }
      
      const userData: SelectUser = await response.json();
      setUser(userData);
      queryClient.setQueryData(['/api/user'], userData);
      
      // Pré-carregar dados com base no papel do usuário
      if (userData.role !== 'admin') {
        try {
          // Carregar dados do departamento para evitar tela vazia após o login
          const [activitiesResponse, statsResponse] = await Promise.all([
            fetch(`/api/activities/department/${userData.role}`, { credentials: 'include' }),
            fetch(`/api/department/${userData.role}/stats`, { credentials: 'include' })
          ]);
          
          if (activitiesResponse.ok) {
            const activitiesData = await activitiesResponse.json();
            queryClient.setQueryData(['/api/department/activities', userData.role], activitiesData);
          }
          
          if (statsResponse.ok) {
            const statsData = await statsResponse.json();
            queryClient.setQueryData(['/api/department/stats', userData.role], statsData);
          }
          
          // Forçar limpar e reprocessar outras consultas que possam estar em cache
          queryClient.invalidateQueries();
          
          // Adicionar um pequeno atraso antes de redirecionar para garantir que os dados sejam carregados
          await new Promise(resolve => setTimeout(resolve, 300));
          
          // Informar no console para debugging
          console.log("Dados do departamento pré-carregados com sucesso:", userData.role);
        } catch (e) {
          console.error("Erro ao pré-carregar dados do departamento:", e);
        }
      }
      
      toast({
        title: "Login realizado com sucesso",
        description: `Bem-vindo, ${userData.name || userData.username}!`,
      });
      
      return userData;
    } catch (err) {
      toast({
        title: "Falha no login",
        description: err instanceof Error ? err.message : "Erro desconhecido",
        variant: "destructive",
      });
      throw err;
    }
  };
  
  // Registro function
  const register = async (data: InsertUser): Promise<SelectUser> => {
    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
        credentials: 'include',
      });
      
      if (!response.ok) {
        const errorMessage = await response.text();
        throw new Error(errorMessage || 'Falha no registro. Por favor, tente novamente.');
      }
      
      const userData: SelectUser = await response.json();
      setUser(userData);
      queryClient.setQueryData(['/api/user'], userData);
      
      toast({
        title: "Registro realizado com sucesso",
        description: `Bem-vindo, ${userData.name || userData.username}!`,
      });
      
      return userData;
    } catch (err) {
      toast({
        title: "Falha no registro",
        description: err instanceof Error ? err.message : "Erro desconhecido",
        variant: "destructive",
      });
      throw err;
    }
  };
  
  // Logout function
  const logout = async (): Promise<void> => {
    try {
      const response = await fetch('/api/logout', {
        method: 'POST',
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Falha ao fazer logout');
      }
      
      setUser(null);
      queryClient.setQueryData(['/api/user'], null);
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
      
      toast({
        title: "Logout realizado com sucesso",
      });
    } catch (err) {
      toast({
        title: "Falha no logout",
        description: err instanceof Error ? err.message : "Erro desconhecido",
        variant: "destructive",
      });
      throw err;
    }
  };
  
  // Logout mutation simulada para compatibilidade com o padrão mutations
  const logoutMutation = {
    mutate: () => {
      logout().catch(err => {
        console.error("Erro ao executar logoutMutation:", err);
      });
    },
    isPending: false
  };
  
  // Valores do contexto
  const contextValue: AuthContextType = {
    user,
    isLoading,
    error,
    login,
    register,
    logout,
    logoutMutation
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

// Hook para usar o contexto de autenticação
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === null) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
