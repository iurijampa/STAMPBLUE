import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";

export default function HomePage() {
  const [, navigate] = useLocation();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/user', {
          credentials: 'include'
        });
        
        if (response.status === 401) {
          navigate("/auth");
          return;
        }
        
        if (response.ok) {
          const userData = await response.json();
          
          if (userData.role === "admin") {
            navigate("/admin/dashboard");
          } else {
            navigate("/department/dashboard");
          }
        }
      } catch (err) {
        console.error("Erro ao verificar autenticação:", err);
        navigate("/auth");
      } finally {
        setIsLoading(false);
      }
    };
    
    checkAuth();
  }, [navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin mb-4" />
      <p className="text-neutral-600">Redirecionando...</p>
    </div>
  );
}
