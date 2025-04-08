import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Logo, FooterCredits } from "@/components/ui/logo";

export default function AuthPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
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
    <div className="min-h-screen bg-background">
      <div className="min-h-screen flex flex-col lg:flex-row">
        {/* Área de Hero - só aparece em telas maiores */}
        <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary-600 to-primary-800">
          <div className="w-full h-full flex items-center justify-center">
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
        <div className="flex flex-1 w-full lg:w-1/2 items-center justify-center">
          <div className="w-full mx-auto max-w-sm px-4 sm:max-w-md sm:px-6">
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