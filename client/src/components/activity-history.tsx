import { useState, useEffect } from "react";
import { Activity } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, ArchiveIcon, Info, RefreshCw, FileText, Clock, CalendarClock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

interface HistoryActivity {
  id: number;
  title: string;
  description: string;
  image: string;
  additionalImages: string[] | null;
  quantity: number;
  clientName: string | null;
  priority: string | null;
  deadline: Date | null;
  notes: string | null;
  createdAt: Date;
  createdBy: number;
  status: "pending" | "in_progress" | "completed";
  completedBy: string;
  completedAt: string;
}

interface ActivityHistoryProps {
  department: string;
}

export default function ActivityHistory({ department }: ActivityHistoryProps) {
  const [activities, setActivities] = useState<HistoryActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  
  const { user } = useAuth();
  const { toast } = useToast();
  
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch(`/api/activities/history/${department}`);
        
        if (!response.ok) {
          throw new Error(`Erro ao carregar histórico (${response.status})`);
        }
        
        const data = await response.json();
        console.log(`Histórico: ${data.length} atividades encontradas`);
        setActivities(data);
      } catch (err) {
        console.error("Erro ao carregar histórico:", err);
        setError(err instanceof Error ? err.message : "Erro desconhecido");
      } finally {
        setLoading(false);
      }
    };
    
    fetchHistory();
  }, [department, refreshKey]);
  
  // Formatar data para exibição
  const formatDate = (dateString: string | Date) => {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  // Renderização do componente
  return (
    <Card className="w-full">
      <CardHeader className="bg-gray-50 dark:bg-gray-800/50">
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ArchiveIcon className="h-5 w-5" />
              Histórico de Atividades
            </CardTitle>
            <CardDescription>
              Atividades concluídas por este departamento
            </CardDescription>
          </div>
          <Button 
            variant="outline"
            size="sm"
            onClick={() => setRefreshKey(prev => prev + 1)}
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Atualizar
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="p-4">
        {loading ? (
          <div className="py-8 flex flex-col items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin mb-2" />
            <p className="text-sm text-muted-foreground">Carregando histórico...</p>
          </div>
        ) : error ? (
          <div className="py-8 flex flex-col items-center justify-center">
            <Info className="h-8 w-8 text-destructive mb-2" />
            <p className="text-sm text-destructive">{error}</p>
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-2"
              onClick={() => setRefreshKey(prev => prev + 1)}
            >
              Tentar novamente
            </Button>
          </div>
        ) : activities.length === 0 ? (
          <div className="py-8 text-center border rounded-md bg-gray-50">
            <ArchiveIcon className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-muted-foreground">Nenhuma atividade concluída encontrada.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {activities.map((activity) => (
              <div 
                key={activity.id}
                className="border rounded-md p-4 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                  <div className="flex-1">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-12 h-12 rounded-md overflow-hidden border">
                        <img 
                          src={activity.image || "/logo.svg"} 
                          alt={activity.title} 
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.src = "/logo.svg";
                            e.currentTarget.classList.add("bg-blue-600");
                          }}
                        />
                      </div>
                      
                      <div className="flex-1">
                        <h3 className="font-medium">{activity.title}</h3>
                        <div className="flex flex-wrap gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            #{activity.id}
                          </Badge>
                          {activity.priority && (
                            <Badge className="bg-red-500 text-xs">
                              Prioridade Alta
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {activity.notes && (
                      <div className="mt-3 bg-gray-50 p-2 rounded-md text-sm">
                        <p className="font-medium text-sm flex items-center">
                          <FileText className="h-4 w-4 mr-1" />
                          Observações:
                        </p>
                        <p className="mt-1">{activity.notes}</p>
                      </div>
                    )}
                    
                    <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center">
                        <Clock className="h-4 w-4 mr-1" />
                        Concluído em: {formatDate(activity.completedAt)}
                      </div>
                      
                      <div className="flex items-center">
                        <CalendarClock className="h-4 w-4 mr-1" />
                        Criado: {formatDate(activity.createdAt)}
                      </div>
                      
                      <div>
                        <span className="font-medium">Concluído por:</span> {activity.completedBy}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}