import { Switch, Route, Redirect } from "wouter";
import { Toaster } from "@/components/ui/toaster";
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
  
  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center">
      <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
    </div>;
  }
  
  if (!user) {
    return <Redirect to="/auth" />;
  }
  
  if (user.role === 'admin') {
    return <Redirect to="/admin/dashboard" />;
  }
  
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
