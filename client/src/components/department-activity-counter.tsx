import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, BarChart3, RefreshCw, Briefcase, Printer, Hammer, Scissors, Package } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Interface para os contadores de departamento
interface DepartmentCounts {
  gabarito: number;
  impressao: number;
  batida: number;
  costura: number;
  embalagem: number;
}

// Mapeamento de ícones para departamentos
const departmentIcons = {
  gabarito: <Briefcase className="h-5 w-5" />,
  impressao: <Printer className="h-5 w-5" />,
  batida: <Hammer className="h-5 w-5" />,
  costura: <Scissors className="h-5 w-5" />,
  embalagem: <Package className="h-5 w-5" />,
};

// Mapeamento de nomes legíveis para departamentos
const departmentNames = {
  gabarito: "Gabarito",
  impressao: "Impressão",
  batida: "Batida",
  costura: "Costura",
  embalagem: "Embalagem",
};

export default function DepartmentActivityCounter() {
  const [counts, setCounts] = useState<DepartmentCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  
  const { toast } = useToast();
  
  useEffect(() => {
    // Cache local para evitar múltiplas chamadas em um curto período
    const cacheKey = `department_counts_${refreshKey}`;
    const cachedData = sessionStorage.getItem(cacheKey);
    
    // Se tiver dados em cache e estiverem atualizados (menos de 1 minuto), use-os
    if (cachedData) {
      try {
        const { data, timestamp } = JSON.parse(cachedData);
        const now = Date.now();
        // Se o cache tiver menos de 30 segundos, use-o
        if (now - timestamp < 30000) {
          setCounts(data);
          setLoading(false);
          return;
        }
      } catch (e) {
        // Se houver erro ao processar o cache, ignore e carregue normalmente
      }
    }
    
    const controller = new AbortController();
    const signal = controller.signal;
    
    const fetchCounts = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch("/api/stats/department-counts", {
          signal,
          headers: {
            "Cache-Control": "max-age=30" // Sugere ao navegador cachear por 30 segundos
          }
        });
        
        if (!response.ok) {
          throw new Error(`Erro ao carregar contadores (${response.status})`);
        }
        
        const data = await response.json();
        // Armazena no cache local
        sessionStorage.setItem(cacheKey, JSON.stringify({
          data,
          timestamp: Date.now()
        }));
        
        if (!signal.aborted) {
          setCounts(data);
        }
      } catch (err) {
        if (!signal.aborted) {
          console.error("Erro ao carregar contadores:", err);
          setError(err instanceof Error ? err.message : "Erro desconhecido");
        }
      } finally {
        if (!signal.aborted) {
          setLoading(false);
        }
      }
    };
    
    fetchCounts();
    
    // Limpeza do controlador em caso de desmontagem do componente
    return () => {
      controller.abort();
    };
  }, [refreshKey]);
  
  // Total de atividades em todos os departamentos
  const totalActivities = counts 
    ? Object.values(counts).reduce((acc, count) => acc + count, 0) 
    : 0;
  
  return (
    <Card className="w-full">
      <CardHeader className="bg-gray-50 dark:bg-gray-800/50">
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Atividades por Departamento
            </CardTitle>
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
            <p className="text-sm text-muted-foreground">Carregando contadores...</p>
          </div>
        ) : error ? (
          <div className="py-8 flex flex-col items-center justify-center">
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
        ) : (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-5">
              {counts && Object.entries(counts)
                // Filtrar departamentos que não estão na lista de departamentos permitidos
                .filter(([dept]) => departmentNames[dept as keyof typeof departmentNames])
                .map(([dept, count]) => (
                <Card key={dept} className="border-2 overflow-hidden">
                  <CardContent className="p-6">
                    <div className="flex flex-col items-center text-center">
                      <div className="p-2 bg-primary/10 rounded-full mb-3">
                        {departmentIcons[dept as keyof typeof departmentIcons]}
                      </div>
                      <div className="space-y-1">
                        <h3 className="font-medium text-sm">
                          {departmentNames[dept as keyof typeof departmentNames]}
                        </h3>
                        <div className="text-2xl font-bold">
                          {count}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                  
                  {/* Barra de progresso na parte inferior */}
                  {totalActivities > 0 && (
                    <div 
                      className="h-1.5 bg-primary" 
                      style={{ width: `${(count / totalActivities) * 100}%` }}
                    ></div>
                  )}
                </Card>
              ))}
            </div>

          </div>
        )}
      </CardContent>
    </Card>
  );
}