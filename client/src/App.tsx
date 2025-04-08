import { useEffect, useState } from "react";
import { Switch, Route, Redirect } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { useQueryClient } from "@tanstack/react-query";
import NotFound from "@/pages/not-found";
import HomePage from "@/pages/home-page";
import TestPage from "@/pages/test-page";
import AuthPage from "@/pages/auth-page";
import AdminDashboard from "@/pages/admin/dashboard";
import AdminUsers from "@/pages/admin/users";
import DepartmentDashboard from "@/pages/department/dashboard";
import { AuthProvider } from "@/hooks/use-auth";
import { useAuth } from "@/hooks/use-auth";

// Componente para redirecionar com base no papel do usuário
function DashboardRedirect() {
  const { user, isLoading } = useAuth();
  const [isDataLoading, setIsDataLoading] = useState(false);
  const queryClient = useQueryClient();
  
  // Efeito para pré-carregar os dados do departamento quando o usuário é carregado
  useEffect(() => {
    async function preloadDepartmentData() {
      if (user && user.role !== 'admin') {
        try {
          setIsDataLoading(true);
          console.log("Pré-carregando dados para o departamento:", user.role);
          
          // Carregar dados do departamento
          const [activitiesResponse, statsResponse] = await Promise.all([
            fetch(`/api/activities/department/${user.role}`, { credentials: 'include' }),
            fetch(`/api/department/${user.role}/stats`, { credentials: 'include' })
          ]);
          
          if (activitiesResponse.ok) {
            const activitiesData = await activitiesResponse.json();
            queryClient.setQueryData(['/api/department/activities', user.role], activitiesData);
            console.log("Atividades carregadas com sucesso:", activitiesData.length);
          }
          
          if (statsResponse.ok) {
            const statsData = await statsResponse.json();
            queryClient.setQueryData(['/api/department/stats', user.role], statsData);
            console.log("Estatísticas carregadas com sucesso:", statsData);
          }
        } catch (error) {
          console.error("Erro ao pré-carregar dados:", error);
        } finally {
          setIsDataLoading(false);
        }
      }
    }
    
    if (user && !isLoading) {
      preloadDepartmentData();
    }
  }, [user, isLoading, queryClient]);
  
  if (isLoading || isDataLoading) {
    return <div className="flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-2">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
        {isDataLoading && <p className="text-sm text-muted-foreground">Carregando dados do departamento...</p>}
      </div>
    </div>;
  }
  
  if (!user) {
    return <Redirect to="/auth" />;
  }
  
  if (user.role === 'admin') {
    return <Redirect to="/admin/dashboard" />;
  }
  
  // Modificado para usar a URL correta do departamento do usuário
  return <Redirect to={`/department/${user.role}/dashboard`} />;
}

function App() {
  return (
    <AuthProvider>
      <Switch>
        <Route path="/" component={DashboardRedirect} />
        <Route path="/auth" component={AuthPage} />
        <Route path="/test" component={TestPage} />
        <Route path="/admin/dashboard" component={AdminDashboard} />
        <Route path="/admin/users" component={AdminUsers} />
        <Route path="/department/:department/dashboard" component={DepartmentDashboard} />
        <Route component={NotFound} />
      </Switch>
      <Toaster />
    </AuthProvider>
  );
}

export default App;
