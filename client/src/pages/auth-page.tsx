import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useState } from "react";

export default function AuthPage() {
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: "admin",
          password: "admin123"
        }),
        credentials: 'include',
      });
      
      if (response.ok) {
        window.location.href = "/";
      } else {
        alert("Falha no login");
      }
    } catch (error) {
      alert("Erro ao fazer login");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: "admin",
          password: "admin123",
          name: "Administrador",
          role: "admin"
        }),
        credentials: 'include',
      });
      
      if (response.ok) {
        window.location.href = "/";
      } else {
        alert("Falha no registro");
      }
    } catch (error) {
      alert("Erro ao fazer registro");
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-neutral-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">Sistema de Gerenciamento</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button 
            onClick={handleLogin}
            className="w-full" 
            disabled={isLoading}
          >
            {isLoading ? "Processando..." : "Login como Admin"}
          </Button>
          <Button 
            onClick={handleRegister}
            className="w-full" 
            variant="outline"
            disabled={isLoading}
          >
            {isLoading ? "Processando..." : "Registrar Admin"}
          </Button>
          <p className="text-sm text-center text-muted-foreground">
            Este é um formulário simplificado para testes.<br />
            Username: admin, Senha: admin123
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
