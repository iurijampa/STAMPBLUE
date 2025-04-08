import { Switch, Route, useLocation, Redirect } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import HomePage from "@/pages/home-page";
import TestPage from "@/pages/test-page";
import AuthPage from "@/pages/auth-page";
import AdminDashboard from "@/pages/admin/dashboard";
import AdminUsers from "@/pages/admin/users";
import DepartmentDashboard from "@/pages/department/dashboard";
import { AuthProvider } from "@/hooks/use-auth";

// Versão simplificada para resolver o problema
function App() {
  return (
    <AuthProvider>
      <Switch>
        <Route path="/" component={HomePage} />
        <Route path="/auth" component={AuthPage} />
        <Route path="/test" component={TestPage} />
        <Route path="/admin/dashboard" component={AdminDashboard} />
        <Route path="/admin/users" component={AdminUsers} />
        <Route path="/department/dashboard" component={DepartmentDashboard} />
        <Route component={NotFound} />
      </Switch>
      <Toaster />
    </AuthProvider>
  );
}

export default App;
