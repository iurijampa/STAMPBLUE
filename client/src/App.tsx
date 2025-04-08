import { Switch, Route, useLocation, Redirect } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import HomePage from "@/pages/home-page";
import TestPage from "@/pages/test-page";
import AuthPage from "@/pages/auth-page";
import AdminDashboard from "@/pages/admin/dashboard";
import AdminUsers from "@/pages/admin/users";
import DepartmentDashboard from "@/pages/department/dashboard";
import { useQuery } from "@tanstack/react-query";
import { AuthProvider } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";

// Protected route component
const ProtectedRoute = ({ component: Component, adminOnly = false, ...rest }: { 
  component: React.ComponentType, 
  adminOnly?: boolean,
  path: string 
}) => {
  const [, navigate] = useLocation();
  
  const { isLoading, data: user } = useQuery({
    queryKey: ["/api/user"],
    queryFn: async () => {
      const res = await fetch("/api/user", { credentials: "include" });
      if (res.status === 401) return null;
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }
  
  if (!user) {
    return <Redirect to="/auth" />;
  }
  
  if (adminOnly && user.role !== "admin") {
    return <Redirect to={`/department/dashboard`} />;
  }
  
  if (!adminOnly && user.role === "admin") {
    return <Redirect to="/admin/dashboard" />;
  }
  
  return <Component />;
};

function App() {
  return (
    <AuthProvider>
      <>
        <Switch>
          <Route path="/" component={HomePage} />
          <Route path="/auth" component={AuthPage} />
          <Route path="/test" component={TestPage} />
          <Route path="/admin/dashboard">
            <ProtectedRoute path="/admin/dashboard" component={AdminDashboard} adminOnly={true} />
          </Route>
          <Route path="/admin/users">
            <ProtectedRoute path="/admin/users" component={AdminUsers} adminOnly={true} />
          </Route>
          <Route path="/department/dashboard">
            <ProtectedRoute path="/department/dashboard" component={DepartmentDashboard} adminOnly={false} />
          </Route>
          <Route component={NotFound} />
        </Switch>
        <Toaster />
      </>
    </AuthProvider>
  );
}

export default App;
