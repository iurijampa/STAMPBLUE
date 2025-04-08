import { createContext, ReactNode, useContext } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
  useQueryClient
} from "@tanstack/react-query";
import { User, InsertUser } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

// Tipo para os dados de login
type LoginData = {
  username: string;
  password: string;
};

// Interface para o contexto de autenticação
interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  error: Error | null;
  login: (data: LoginData) => Promise<User>;
  register: (data: InsertUser) => Promise<User>;
  logout: () => Promise<void>;
}

// Criando o contexto
const AuthContext = createContext<AuthContextType | null>(null);

// Hook para usar o contexto
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

// Provider component
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  // Buscar o usuário atual
  const { 
    data: user,
    isLoading,
    error 
  } = useQuery<User | null, Error>({
    queryKey: ['/api/user'],
    queryFn: async () => {
      try {
        const response = await fetch('/api/user', {
          credentials: 'include'
        });
        
        if (response.status === 401) {
          return null;
        }
        
        if (!response.ok) {
          throw new Error(`Error: ${response.status}`);
        }
        
        return await response.json();
      } catch (err) {
        console.error("Error fetching user:", err);
        return null;
      }
    },
    staleTime: 300000, // 5 minutos
    retry: false
  });
  
  // Login
  const login = async (data: LoginData): Promise<User> => {
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
      
      const userData = await response.json();
      queryClient.setQueryData(['/api/user'], userData);
      
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
  
  // Registro
  const register = async (data: InsertUser): Promise<User> => {
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
        const text = await response.text();
        throw new Error(text || 'Falha no registro. Por favor, tente novamente.');
      }
      
      const userData = await response.json();
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
  
  // Logout
  const logout = async (): Promise<void> => {
    try {
      const response = await fetch('/api/logout', {
        method: 'POST',
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Falha ao fazer logout');
      }
      
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
  
  // Valor do contexto
  const contextValue: AuthContextType = {
    user: user || null,
    isLoading,
    error,
    login,
    register,
    logout
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}