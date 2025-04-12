import React, { useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Loader2, ArchiveIcon, RefreshCw } from "lucide-react";
import ActivityHistory from "@/components/activity-history";

export default function DepartmentHistory() {
  const params = useParams();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user, logoutMutation } = useAuth();
  
  // Obtendo o departamento da URL
  const department = params.department;
  
  // Verificar se o usuário está logado e tem permissão para acessar este departamento
  useEffect(() => {
    if (user) {
      // Se o usuário é admin, ele não deveria estar aqui
      if (user.role === 'admin') {
        console.log('Usuário admin detectado no dashboard de departamento. Redirecionando para o admin dashboard.');
        navigate('/admin/dashboard', { replace: true });
        return;
      }
      
      // Se o usuário não é admin e o departamento na URL não corresponde ao seu, redirecione
      if (department !== user.role) {
        console.log(`Correção de departamento: redirecionando de ${department} para ${user.role}`);
        navigate(`/department/${user.role}/dashboard`, { replace: true });
        return;
      }
    }
  }, [user, department, navigate]);
  
  // Sempre usar o departamento do usuário logado, ignorando o que está na URL
  const userDepartment = user?.role !== 'admin' ? user?.role : department;
  
  // Função para atualizar dados
  const handleRefresh = () => {
    window.location.reload();
  };
  
  // Função para logout
  const handleLogout = () => {
    try {
      logoutMutation.mutate();
      navigate("/auth");
    } catch (error) {
      console.error("Erro ao fazer logout:", error);
    }
  };
  
  // Função para ir para o dashboard
  const goToDashboard = () => {
    navigate(`/department/${userDepartment}/dashboard`);
  };
  
  // Função para capitalizar a primeira letra
  const capitalize = (str: string) => {
    return str.charAt(0).toUpperCase() + str.slice(1);
  };
  
  return (
    <Layout title={`Histórico - ${userDepartment ? capitalize(userDepartment) : 'Departamento'}`}>
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold flex items-center">
            <ArchiveIcon className="h-6 w-6 mr-2" />
            Histórico - {userDepartment ? capitalize(userDepartment) : 'Departamento'}
          </h1>
        </div>
        
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={goToDashboard}
            className="flex items-center gap-1"
          >
            Voltar ao Dashboard
          </Button>
          
          <Button
            variant="outline"
            onClick={handleRefresh}
            className="flex items-center gap-1"
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Atualizar
          </Button>
          
          <Button
            variant="outline"
            onClick={handleLogout}
            className="flex items-center gap-1"
          >
            Sair
          </Button>
        </div>
      </div>
      
      {!user ? (
        <div className="h-64 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
        </div>
      ) : (
        <div className="space-y-6">
          <ActivityHistory department={userDepartment || ''} />
        </div>
      )}
    </Layout>
  );
}