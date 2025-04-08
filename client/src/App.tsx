import { Switch, Route } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
import HomePage from "@/pages/home-page";
import AdminDashboard from "@/pages/admin/dashboard";
import DepartmentDashboard from "@/pages/department/dashboard";
import AdminUsers from "@/pages/admin/users";
import { ProtectedRoute } from "./lib/protected-route";

function App() {
  return (
    <>
      <Switch>
        <Route path="/auth" component={AuthPage} />
        
        {/* Protected routes */}
        <ProtectedRoute path="/" component={HomePage} />
        
        {/* Admin routes */}
        <ProtectedRoute path="/admin/dashboard" component={AdminDashboard} />
        <ProtectedRoute path="/admin/users" component={AdminUsers} />
        
        {/* Department route */}
        <ProtectedRoute path="/department/dashboard" component={DepartmentDashboard} />
        
        {/* Fallback to 404 */}
        <Route component={NotFound} />
      </Switch>
      <Toaster />
    </>
  );
}

export default App;
