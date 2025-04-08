import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Logo, FooterCredits } from "@/components/ui/logo";

export default function AuthPage() {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin123");
  const [name, setName] = useState("Administrador");
  const [role, setRole] = useState("admin");
  const [isLoading, setIsLoading] = useState(false);
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Falha no login. Por favor, verifique suas credenciais.');
      }
      
      const userData = await response.json();
      
      toast({
        title: "Login realizado com sucesso",
        description: `Bem-vindo, ${userData.name || userData.username}!`,
      });
      
      // Redirecionar para o dashboard apropriado
      if (userData.role === 'admin') {
        navigate("/admin/dashboard");
      } else {
        navigate(`/department/${userData.role}/dashboard`);
      }
    } catch (err) {
      toast({
        title: "Falha no login",
        description: err instanceof Error ? err.message : "Erro desconhecido",
        variant: "destructive",
      });
      console.error("Erro ao fazer login:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          username, 
          password, 
          name, 
          role 
        }),
        credentials: 'include',
      });
      
      if (!response.ok) {
        const errorMessage = await response.text();
        throw new Error(errorMessage || 'Falha no registro. Por favor, tente novamente.');
      }
      
      const userData = await response.json();
      
      toast({
        title: "Registro realizado com sucesso",
        description: `Bem-vindo, ${userData.name || userData.username}!`,
      });
      
      // Redirecionar para o dashboard apropriado
      if (userData.role === 'admin') {
        navigate("/admin/dashboard");
      } else {
        navigate(`/department/${userData.role}/dashboard`);
      }
    } catch (err) {
      toast({
        title: "Falha no registro",
        description: err instanceof Error ? err.message : "Erro desconhecido",
        variant: "destructive",
      });
      console.error("Erro ao fazer registro:", err);
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="flex flex-col md:flex-row min-h-screen h-full">
      {/* Hero Section - Oculto em telas muito pequenas */}
      <div className="hidden sm:flex w-full md:w-1/2 bg-gradient-to-br from-primary-600 to-primary-800 items-center justify-center">
        <div className="max-w-md text-white space-y-4 px-4">
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
      
      {/* Form Section - Tela inteira em mobile */}
      <div className="w-full md:w-1/2 bg-background flex flex-1 justify-center items-center min-h-screen py-8">
        <div className="w-full max-w-md px-4 py-6 flex flex-col h-full">
          <div className="text-center mb-6 md:mb-8 flex flex-col items-center">
            <div className="mb-4">
              <Logo size="xl" className="text-primary-600" />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold">Acesso ao Sistema</h2>
            <p className="text-muted-foreground mt-2">Faça login para acessar o painel</p>
          </div>

          <Card className="w-full mb-auto">
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
          
          <FooterCredits />
        </div>
      </div>
    </div>
  );
}