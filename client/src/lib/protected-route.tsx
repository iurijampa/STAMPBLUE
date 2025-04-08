import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { Redirect, Route, useLocation } from "wouter";

// Componente para encapsular a lógica de roteamento protegido
export function ProtectedRoute({
  path,
  component: Component,
}: {
  path: string;
  component: () => React.JSX.Element;
}) {
  return (
    <Route path={path}>
      {() => <ProtectedComponent Component={Component} />}
    </Route>
  );
}

// Componente interno que verifica a autenticação
function ProtectedComponent({
  Component,
}: {
  Component: () => React.JSX.Element;
}) {
  const { user, isLoading } = useAuth();
  const [location, navigate] = useLocation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/auth" />;
  }

  // Redirecionar usuários não-admin para o dashboard de seu departamento
  useEffect(() => {
    if (user && user.role !== 'admin' && location === '/') {
      navigate(`/department/${user.role}/dashboard`);
    }
  }, [user, navigate, location]);

  return <Component />;
}
