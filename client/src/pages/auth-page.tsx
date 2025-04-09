import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Logo, FooterCredits } from "@/components/ui/logo";
import { useAuth } from "@/hooks/use-auth";

export default function AuthPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"admin" | "gabarito" | "impressao" | "batida" | "costura" | "embalagem" | "user">("admin");
  const [isLoading, setIsLoading] = useState(false);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  
  // Obter métodos do hook de autenticação
  const { login, register, user, isLoading: authLoading } = useAuth();
  
  // Redirecionar para o dashboard se o usuário já estiver autenticado
  useEffect(() => {
    if (user && !authLoading) {
      // Se o usuário já estiver logado, redirecionar para a raiz
      navigate("/", { replace: true });
    }
  }, [user, authLoading, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isLoading) return; // Evitar múltiplos cliques
    
    setIsLoading(true);
    
    try {
      // Usar o método login do hook de autenticação
      await login({ username, password });
      
      // Força navegação após login bem-sucedido
      setTimeout(() => {
        navigate("/", { replace: true });
      }, 500);
      
    } catch (err) {
      console.error("Erro ao fazer login:", err);
      // Toast de erro já é mostrado pelo hook de autenticação
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isLoading) return; // Evitar múltiplos cliques
    
    setIsLoading(true);
    
    try {
      // Usar o método register do hook de autenticação
      // Definir departamento igual ao role para manter compatibilidade com a estrutura
      await register({ 
        username, 
        password, 
        name, 
        role,
        department: role 
      });
      
      // Força navegação após registro bem-sucedido
      setTimeout(() => {
        navigate("/", { replace: true });
      }, 500);
      
    } catch (err) {
      console.error("Erro ao fazer registro:", err);
      // Toast de erro já é mostrado pelo hook de autenticação
    } finally {
      setIsLoading(false);
    }
  };
  
  // Se estiver carregando o estado de autenticação, mostrar indicador
  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }
  
  // Se o usuário já estiver autenticado, não mostrar a página de login
  if (user) {
    return null; // O useEffect vai redirecionar
  }
  
  return (
    <div className="min-h-screen bg-background">
      <div className="grid min-h-screen lg:grid-cols-2">
        {/* Área de Hero - só aparece em telas maiores */}
        <div className="hidden lg:block bg-gradient-to-br from-primary-600 to-primary-800">
          <div className="flex h-full items-center justify-center">
            <div className="max-w-md text-white space-y-4 px-6">
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
                Sistema de Gerenciamento de Produção
              </h1>
              <p className="text-base md:text-lg text-primary-50">
                Bem-vindo ao sistema de gerenciamento de fluxo de trabalho para fábrica de camisas. 
                Este sistema permite o controle completo do processo de produção entre diferentes setores.
              </p>
              <div className="bg-white/10 p-4 rounded-lg backdrop-blur-sm">
                <h3 className="font-semibold text-primary-50 mb-2">Funcionalidades principais:</h3>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2">
                    <span className="bg-primary-400 rounded-full p-1 w-6 h-6 flex items-center justify-center text-xs">✓</span>
                    <span>Rastreamento sequencial de tarefas</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="bg-primary-400 rounded-full p-1 w-6 h-6 flex items-center justify-center text-xs">✓</span>
                    <span>Controle de acessos baseado em funções</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="bg-primary-400 rounded-full p-1 w-6 h-6 flex items-center justify-center text-xs">✓</span>
                    <span>Notificações de mudanças de status</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
        
        {/* Área de Login - centralizada */}
        <div className="flex items-center justify-center">
          <div className="w-full max-w-md mx-auto px-6 py-12">
            <div className="text-center mb-8">
              <div className="mx-auto mb-6 flex justify-center">
                <Logo size="xl" className="text-primary-600" />
              </div>
              <h2 className="text-2xl font-bold">Acesso ao Sistema</h2>
              <p className="text-muted-foreground mt-2">Faça login para acessar o painel</p>
            </div>

            <Card className="shadow-md">
              <CardHeader>
                <CardTitle>Login</CardTitle>
                <CardDescription>
                  Entre com suas credenciais para acessar o sistema
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-username">Nome de usuário</Label>
                    <Input 
                      id="login-username" 
                      value={username} 
                      onChange={(e) => setUsername(e.target.value)} 
                      required 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Senha</Label>
                    <Input 
                      id="login-password" 
                      type="password" 
                      value={password} 
                      onChange={(e) => setPassword(e.target.value)} 
                      required 
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={isLoading}
                  >
                    {isLoading ? "Processando..." : "Entrar"}
                  </Button>
                </form>
              </CardContent>
            </Card>
            
            <div className="mt-8 text-center">
              <FooterCredits />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}