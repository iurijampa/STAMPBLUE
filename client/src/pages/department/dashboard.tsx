import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import Layout from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Search, Calendar, Check, ImageIcon } from "lucide-react";
import CompleteActivityModal from "@/components/complete-activity-modal";

export default function DepartmentDashboard() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [completeActivityId, setCompleteActivityId] = useState<number | null>(null);
  const departmentName = user?.role || "";
  
  // Format department name
  const formatDepartmentName = (role: string) => {
    switch (role) {
      case "gabarito": return "Gabarito";
      case "impressao": return "Impressão";
      case "batida": return "Batida";
      case "costura": return "Costura";
      case "embalagem": return "Embalagem";
      default: return role;
    }
  };
  
  // Fetch activities for this department
  const { 
    data: activities = [], 
    isLoading: isLoadingActivities
  } = useQuery({
    queryKey: ["/api/activities"],
    enabled: !!user,
  });
  
  // Fetch completed activities for this department
  const { 
    data: completedActivities = [], 
    isLoading: isLoadingCompleted 
  } = useQuery({
    queryKey: ["/api/activities/completed"],
    enabled: !!user,
  });
  
  // Filter activities based on search
  const filteredActivities = activities.filter((activity: any) => {
    return (
      activity.title.toLowerCase().includes(search.toLowerCase()) ||
      activity.description.toLowerCase().includes(search.toLowerCase())
    );
  });
  
  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  return (
    <Layout title={`Setor ${formatDepartmentName(departmentName)}`}>
      <div className="flex flex-col sm:flex-row justify-between mb-6 gap-3">
        <div>
          <h2 className="text-xl font-semibold text-neutral-800">Setor {formatDepartmentName(departmentName)}</h2>
          <p className="text-neutral-500">Suas atividades pendentes</p>
        </div>
        
        <div className="relative">
          <Input 
            placeholder="Buscar atividades..." 
            className="w-full sm:w-64 pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
        </div>
      </div>
      
      {/* Department Activities */}
      {isLoadingActivities ? (
        <div className="flex justify-center items-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
        </div>
      ) : filteredActivities.length === 0 ? (
        <div className="p-8 text-center bg-white rounded-lg border border-neutral-200 shadow-sm">
          <div className="mb-4">
            <ImageIcon className="h-12 w-12 mx-auto text-neutral-300" />
          </div>
          <h3 className="text-lg font-medium text-neutral-700 mb-2">Nenhuma atividade pendente</h3>
          <p className="text-neutral-500">
            Não há atividades pendentes para este setor no momento.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredActivities.map((activity: any) => (
            <Card key={activity.id} className="overflow-hidden">
              <div className="aspect-w-16 aspect-h-9 bg-neutral-100">
                <img 
                  src={activity.image} 
                  alt={activity.title} 
                  className="w-full h-48 object-cover" 
                />
              </div>
              
              <CardContent className="p-4">
                <h3 className="font-semibold text-neutral-800 mb-2">{activity.title}</h3>
                
                <div className="mb-3">
                  <div className="text-sm text-neutral-500 mb-1">Descrição:</div>
                  <p className="text-sm text-neutral-700">
                    {activity.description}
                  </p>
                </div>
                
                <div className="mb-4">
                  <div className="text-sm text-neutral-500 mb-1">Criado em:</div>
                  <div className="text-sm text-neutral-700 flex items-center">
                    <Calendar className="mr-1 h-4 w-4" />
                    <span>{formatDate(activity.createdAt)}</span>
                  </div>
                </div>
                
                {/* Department Action */}
                <Button
                  className="w-full bg-primary-700 hover:bg-primary-800"
                  onClick={() => setCompleteActivityId(activity.id)}
                >
                  <Check className="mr-2 h-4 w-4" />
                  <span>Marcar como Concluído</span>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      
      {/* Completed Activities Section */}
      <div className="mt-8">
        <h3 className="text-lg font-semibold text-neutral-800 mb-4">Atividades Concluídas Recentemente</h3>
        
        <Card>
          <CardContent className="p-0">
            <table className="min-w-full">
              <thead>
                <tr className="bg-neutral-100 text-neutral-600 text-sm">
                  <th className="py-3 px-4 text-left font-medium">Atividade</th>
                  <th className="py-3 px-4 text-left font-medium">Concluído por</th>
                  <th className="py-3 px-4 text-left font-medium">Data</th>
                  <th className="py-3 px-4 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 text-sm">
                {isLoadingCompleted ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-neutral-400" />
                    </td>
                  </tr>
                ) : completedActivities.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-neutral-500">
                      Nenhuma atividade concluída recentemente
                    </td>
                  </tr>
                ) : (
                  completedActivities.map((item: any) => (
                    <tr key={item.progress.id}>
                      <td className="py-3 px-4 text-neutral-800">{item.activity.title}</td>
                      <td className="py-3 px-4 text-neutral-600">{item.progress.completedBy}</td>
                      <td className="py-3 px-4 text-neutral-600">{formatDate(item.progress.completedAt)}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-1 bg-success-500 bg-opacity-10 text-success-600 rounded-full text-xs font-medium">
                          Concluído
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
      
      {/* Complete Activity Modal */}
      <CompleteActivityModal 
        isOpen={completeActivityId !== null}
        onClose={() => setCompleteActivityId(null)}
        activityId={completeActivityId}
      />
    </Layout>
  );
}
