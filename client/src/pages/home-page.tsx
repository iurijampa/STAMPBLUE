import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";

export default function HomePage() {
  const [_, navigate] = useLocation();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      if (user?.role === "admin") {
        navigate("/admin/dashboard");
      } else {
        navigate("/department/dashboard");
      }
    }
  }, [user, isLoading, navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin mb-4" />
      <p className="text-neutral-600">Redirecionando...</p>
    </div>
  );
}
