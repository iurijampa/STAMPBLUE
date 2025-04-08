import { useState } from "react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Search, Plus, Edit, Trash2, Check, Calendar } from "lucide-react";
import CreateActivityModal from "@/components/create-activity-modal";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function AdminDashboard() {
  const { toast } = useToast();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [editingActivityId, setEditingActivityId] = useState<number | null>(null);
  
  // Fetch activities
  const { 
    data: activities = [], 
    isLoading, 
    error 
  } = useQuery({
    queryKey: ["/api/activities"],
  });
  
  // Fetch stats
  const { 
    data: stats = { total: 0, inProgress: 0, completed: 0 }, 
    isLoading: isLoadingStats 
  } = useQuery({
    queryKey: ["/api/stats"],
  });
  
  // Filter activities based on search and active tab
  const filteredActivities = activities.filter((activity: any) => {
    const matchesSearch = 
      activity.title.toLowerCase().includes(search.toLowerCase()) ||
      activity.description.toLowerCase().includes(search.toLowerCase());
    
    if (activeTab === "all") return matchesSearch;
    if (activeTab === "inProgress") return matchesSearch && activity.status === "in_progress";
    if (activeTab === "completed") return matchesSearch && activity.status === "completed";
    
    return matchesSearch;
  });
  
  // Delete activity
  const deleteActivity = async (id: number) => {
    if (window.confirm("Tem certeza que deseja excluir esta atividade?")) {
      try {
        await apiRequest("DELETE", `/api/activities/${id}`);
        
        toast({
          title: "Atividade excluída",
          description: "A atividade foi excluída com sucesso.",
        });
        
        // Refresh activities
        queryClient.invalidateQueries({ queryKey: ["/api/activities"] });
        queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      } catch (error) {
        toast({
          title: "Erro ao excluir atividade",
          description: "Ocorreu um erro ao excluir a atividade.",
          variant: "destructive",
        });
      }
    }
  };
  
  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  return (
    <Layout title="Dashboard">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Total Activities */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-neutral-500">Total de Atividades</h3>
              <i className="ri-todo-line text-primary-500 text-xl"></i>
            </div>
            
            {isLoadingStats ? (
              <div className="h-7 flex items-center">
                <Loader2 className="h-5 w-5 animate-spin text-neutral-400" />
              </div>
            ) : (
              <>
                <p className="text-2xl font-semibold text-neutral-800">{stats.total}</p>
                <div className="text-xs text-neutral-500 mt-1">
                  <span className="text-success-500">Visão geral de atividades</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>
        
        {/* In Progress */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-neutral-500">Em Produção</h3>
              <i className="ri-time-line text-warning-500 text-xl"></i>
            </div>
            
            {isLoadingStats ? (
              <div className="h-7 flex items-center">
                <Loader2 className="h-5 w-5 animate-spin text-neutral-400" />
              </div>
            ) : (
              <>
                <p className="text-2xl font-semibold text-neutral-800">{stats.inProgress}</p>
                <div className="text-xs text-neutral-500 mt-1">
                  Atividades em andamento
                </div>
              </>
            )}
          </CardContent>
        </Card>
        
        {/* Completed */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-neutral-500">Concluídas</h3>
              <i className="ri-check-double-line text-success-500 text-xl"></i>
            </div>
            
            {isLoadingStats ? (
              <div className="h-7 flex items-center">
                <Loader2 className="h-5 w-5 animate-spin text-neutral-400" />
              </div>
            ) : (
              <>
                <p className="text-2xl font-semibold text-neutral-800">{stats.completed}</p>
                <div className="text-xs text-neutral-500 mt-1">
                  Atividades finalizadas
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
      
      {/* Actions Row */}
      <div className="flex flex-col sm:flex-row justify-between mb-4 gap-3">
        <h2 className="text-xl font-semibold text-neutral-800">Atividades</h2>
        
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative">
            <Input 
              placeholder="Buscar atividades..." 
              className="w-full sm:w-64 pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
          </div>
          
          <Button 
            className="bg-primary-700 hover:bg-primary-800"
            onClick={() => setIsCreateModalOpen(true)}
          >
            <Plus className="mr-2 h-4 w-4" />
            Nova Atividade
          </Button>
        </div>
      </div>
      
      {/* Tabs */}
      <div className="border-b border-neutral-200 mb-4">
        <div className="flex overflow-x-auto -mb-px">
          <button 
            className={`px-4 py-2 border-b-2 font-medium whitespace-nowrap ${
              activeTab === "all" 
                ? "border-primary-500 text-primary-700" 
                : "border-transparent text-neutral-600 hover:text-neutral-800 hover:border-neutral-300"
            }`}
            onClick={() => setActiveTab("all")}
          >
            Todas ({stats.total})
          </button>
          
          <button 
            className={`px-4 py-2 border-b-2 font-medium whitespace-nowrap ${
              activeTab === "inProgress" 
                ? "border-primary-500 text-primary-700" 
                : "border-transparent text-neutral-600 hover:text-neutral-800 hover:border-neutral-300"
            }`}
            onClick={() => setActiveTab("inProgress")}
          >
            Em Produção ({stats.inProgress})
          </button>
          
          <button 
            className={`px-4 py-2 border-b-2 font-medium whitespace-nowrap ${
              activeTab === "completed" 
                ? "border-primary-500 text-primary-700" 
                : "border-transparent text-neutral-600 hover:text-neutral-800 hover:border-neutral-300"
            }`}
            onClick={() => setActiveTab("completed")}
          >
            Concluídas ({stats.completed})
          </button>
        </div>
      </div>
      
      {/* Activities List */}
      {isLoading ? (
        <div className="flex justify-center items-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
        </div>
      ) : error ? (
        <div className="p-8 text-center">
          <p className="text-red-500">Erro ao carregar atividades. Tente novamente mais tarde.</p>
        </div>
      ) : filteredActivities.length === 0 ? (
        <div className="p-8 text-center bg-white rounded-lg border border-neutral-200 shadow-sm">
          <div className="text-neutral-500">Nenhuma atividade encontrada.</div>
        </div>
      ) : (
        <div className="space-y-4 mb-6">
          {filteredActivities.map((activity: any) => (
            <Card key={activity.id} className="overflow-hidden">
              <CardContent className="p-0">
                <div className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-neutral-800 mb-1">{activity.title}</h3>
                      <div className="flex items-center text-sm text-neutral-500">
                        <Calendar className="mr-1 h-4 w-4" />
                        <span>Criado em {formatDate(activity.createdAt)}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditingActivityId(activity.id);
                          setIsCreateModalOpen(true);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteActivity(activity.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="flex flex-col md:flex-row gap-4">
                    {/* Activity Image */}
                    <div className="w-full md:w-1/4 h-40 bg-neutral-100 rounded-md overflow-hidden flex items-center justify-center">
                      <img 
                        src={activity.image} 
                        alt={activity.title} 
                        className="w-full h-full object-cover" 
                      />
                    </div>
                    
                    {/* Activity Details */}
                    <div className="w-full md:w-3/4">
                      <div className="mb-3">
                        <h4 className="text-sm font-medium text-neutral-500 mb-1">Descrição:</h4>
                        <p className="text-neutral-700 text-sm">{activity.description}</p>
                      </div>
                      
                      {/* Progress Tracker */}
                      {activity.progress && (
                        <div className="mb-4">
                          <h4 className="text-sm font-medium text-neutral-500 mb-2">Status de Produção:</h4>
                          <div className="flex items-center justify-between gap-2">
                            {/* Gabarito */}
                            <div className="flex-1">
                              <div className="flex items-center justify-between text-xs mb-1">
                                <span>Gabarito</span>
                                <span className={activity.progress.gabarito?.status === "completed" ? "text-success-500" : "text-neutral-500"}>
                                  {activity.progress.gabarito?.status === "completed" ? "Concluído" : "Pendente"}
                                </span>
                              </div>
                              <div className="w-full bg-neutral-200 rounded-full h-2">
                                <div 
                                  className={`h-2 rounded-full ${
                                    activity.progress.gabarito?.status === "completed" ? "bg-success-500 w-full" : "w-0"
                                  }`}
                                ></div>
                              </div>
                              <div className="text-xs mt-1 text-neutral-500">
                                {activity.progress.gabarito?.completedBy 
                                  ? `${activity.progress.gabarito.completedBy} - ${formatDate(activity.progress.gabarito.completedAt)}` 
                                  : "-"}
                              </div>
                            </div>
                            
                            {/* Impressão */}
                            <div className="flex-1">
                              <div className="flex items-center justify-between text-xs mb-1">
                                <span>Impressão</span>
                                <span className={activity.progress.impressao?.status === "completed" ? "text-success-500" : "text-neutral-500"}>
                                  {activity.progress.impressao?.status === "completed" ? "Concluído" : "Pendente"}
                                </span>
                              </div>
                              <div className="w-full bg-neutral-200 rounded-full h-2">
                                <div 
                                  className={`h-2 rounded-full ${
                                    activity.progress.impressao?.status === "completed" ? "bg-success-500 w-full" : "w-0"
                                  }`}
                                ></div>
                              </div>
                              <div className="text-xs mt-1 text-neutral-500">
                                {activity.progress.impressao?.completedBy 
                                  ? `${activity.progress.impressao.completedBy} - ${formatDate(activity.progress.impressao.completedAt)}` 
                                  : "-"}
                              </div>
                            </div>
                            
                            {/* Batida */}
                            <div className="flex-1">
                              <div className="flex items-center justify-between text-xs mb-1">
                                <span>Batida</span>
                                <span 
                                  className={
                                    activity.progress.batida?.status === "completed" 
                                      ? "text-success-500" 
                                      : (activity.progress.batida?.status === "pending" && activity.progress.impressao?.status === "completed")
                                        ? "text-warning-500"
                                        : "text-neutral-500"
                                  }
                                >
                                  {activity.progress.batida?.status === "completed" 
                                    ? "Concluído" 
                                    : (activity.progress.batida?.status === "pending" && activity.progress.impressao?.status === "completed")
                                      ? "Em progresso"
                                      : "Pendente"}
                                </span>
                              </div>
                              <div className="w-full bg-neutral-200 rounded-full h-2">
                                <div 
                                  className={`h-2 rounded-full ${
                                    activity.progress.batida?.status === "completed" 
                                      ? "bg-success-500 w-full" 
                                      : (activity.progress.batida?.status === "pending" && activity.progress.impressao?.status === "completed")
                                        ? "bg-warning-500 w-1/2"
                                        : "w-0"
                                  }`}
                                ></div>
                              </div>
                              <div className="text-xs mt-1 text-neutral-500">
                                {activity.progress.batida?.completedBy 
                                  ? `${activity.progress.batida.completedBy} - ${formatDate(activity.progress.batida.completedAt)}` 
                                  : (activity.progress.batida?.status === "pending" && activity.progress.impressao?.status === "completed")
                                    ? "Em andamento"
                                    : "-"}
                              </div>
                            </div>
                            
                            {/* Costura */}
                            <div className="flex-1">
                              <div className="flex items-center justify-between text-xs mb-1">
                                <span>Costura</span>
                                <span 
                                  className={
                                    activity.progress.costura?.status === "completed" 
                                      ? "text-success-500" 
                                      : (activity.progress.costura?.status === "pending" && activity.progress.batida?.status === "completed")
                                        ? "text-warning-500"
                                        : "text-neutral-500"
                                  }
                                >
                                  {activity.progress.costura?.status === "completed" 
                                    ? "Concluído" 
                                    : (activity.progress.costura?.status === "pending" && activity.progress.batida?.status === "completed")
                                      ? "Em progresso"
                                      : "Pendente"}
                                </span>
                              </div>
                              <div className="w-full bg-neutral-200 rounded-full h-2">
                                <div 
                                  className={`h-2 rounded-full ${
                                    activity.progress.costura?.status === "completed" 
                                      ? "bg-success-500 w-full" 
                                      : (activity.progress.costura?.status === "pending" && activity.progress.batida?.status === "completed")
                                        ? "bg-warning-500 w-1/2"
                                        : "w-0"
                                  }`}
                                ></div>
                              </div>
                              <div className="text-xs mt-1 text-neutral-500">
                                {activity.progress.costura?.completedBy 
                                  ? `${activity.progress.costura.completedBy} - ${formatDate(activity.progress.costura.completedAt)}` 
                                  : (activity.progress.costura?.status === "pending" && activity.progress.batida?.status === "completed")
                                    ? "Em andamento"
                                    : "-"}
                              </div>
                            </div>
                            
                            {/* Embalagem */}
                            <div className="flex-1">
                              <div className="flex items-center justify-between text-xs mb-1">
                                <span>Embalagem</span>
                                <span 
                                  className={
                                    activity.progress.embalagem?.status === "completed" 
                                      ? "text-success-500" 
                                      : (activity.progress.embalagem?.status === "pending" && activity.progress.costura?.status === "completed")
                                        ? "text-warning-500"
                                        : "text-neutral-500"
                                  }
                                >
                                  {activity.progress.embalagem?.status === "completed" 
                                    ? "Concluído" 
                                    : (activity.progress.embalagem?.status === "pending" && activity.progress.costura?.status === "completed")
                                      ? "Em progresso"
                                      : "Pendente"}
                                </span>
                              </div>
                              <div className="w-full bg-neutral-200 rounded-full h-2">
                                <div 
                                  className={`h-2 rounded-full ${
                                    activity.progress.embalagem?.status === "completed" 
                                      ? "bg-success-500 w-full" 
                                      : (activity.progress.embalagem?.status === "pending" && activity.progress.costura?.status === "completed")
                                        ? "bg-warning-500 w-1/2"
                                        : "w-0"
                                  }`}
                                ></div>
                              </div>
                              <div className="text-xs mt-1 text-neutral-500">
                                {activity.progress.embalagem?.completedBy 
                                  ? `${activity.progress.embalagem.completedBy} - ${formatDate(activity.progress.embalagem.completedAt)}` 
                                  : (activity.progress.embalagem?.status === "pending" && activity.progress.costura?.status === "completed")
                                    ? "Em andamento"
                                    : "-"}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      
      {/* Create Activity Modal */}
      <CreateActivityModal 
        isOpen={isCreateModalOpen} 
        onClose={() => {
          setIsCreateModalOpen(false);
          setEditingActivityId(null);
        }}
        activityId={editingActivityId}
      />
    </Layout>
  );
}
