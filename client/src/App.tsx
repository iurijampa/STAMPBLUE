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
import { WebSocketProvider } from "@/hooks/websocket-provider";
import { SoundManagerProvider } from "@/components/SoundManagerSimples";
import SimpleSoundPlayer from "@/components/SimpleSoundPlayer";
import SoundTestToque from "@/components/SoundTestToque";
import SoundAutoInitializer from "@/components/SoundAutoInitializer";

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
  
  // Mostrar carregamento enquanto aguarda dados do usuário
  if (isLoading || isDataLoading) {
    return <div className="flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-2">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
        {isDataLoading && <p className="text-sm text-muted-foreground">Carregando dados do departamento...</p>}
      </div>
    </div>;
  }
  
  // Usuário não autenticado: redirecionar para página de login
  if (!user) {
    console.log("Usuário não autenticado. Redirecionando para /auth");
    return <Redirect to="/auth" />;
  }
  
  // Usuário administrador: redirecionar para dashboard admin
  if (user.role === 'admin') {
    console.log("Usuário admin. Redirecionando para /admin/dashboard");
    return <Redirect to="/admin/dashboard" />;
  }
  
  // Usuário de departamento: redirecionar para dashboard específico do departamento
  console.log(`Usuário de departamento ${user.role}. Redirecionando para /department/${user.role}/dashboard`);
  return <Redirect to={`/department/${user.role}/dashboard`} />;
}

function App() {
  // Ordem correta dos provedores:
  // 1. AuthProvider primeiro (pois todos os outros dependem dele)
  // 2. WebSocketProvider segundo (pois dependem de dados de autenticação)
  // 3. SoundManagerProvider por último (não é dependência crítica)
  return (
    <AuthProvider>
      <WebSocketProvider>
        <SoundManagerProvider>
          {/* Componentes de som */}
          <SimpleSoundPlayer />
          <SoundTestToque />
          <SoundAutoInitializer />
          
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
        </SoundManagerProvider>
      </WebSocketProvider>
    </AuthProvider>
  );
}

export default App;
