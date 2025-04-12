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
    // Melhor variável de controle para evitar atualizações em componentes desmontados
    let isMounted = true;
    
    // Usar cache de browser para reduzir chamadas à API
    const controller = new AbortController();
    const signal = controller.signal;
    
    const fetchCounts = async () => {
      try {
        if (isMounted) setLoading(true);
        if (isMounted) setError(null);
        
        // Configuração otimizada para fetch com cache e timeout
        const timeoutId = setTimeout(() => {
          if (isMounted && loading) {
            controller.abort();
            setError("Tempo limite excedido ao carregar contadores");
            setLoading(false);
          }
        }, 5000); // 5 segundos de timeout
        
        const response = await fetch("/api/stats/department-counts", {
          signal,
          headers: {
            "Cache-Control": "max-age=30" // Sugere ao navegador cachear por 30 segundos
          }
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`Erro ao carregar contadores (${response.status})`);
        }
        
        const data = await response.json();
        
        // Só atualiza o estado se o componente ainda estiver montado
        if (isMounted) {
          setCounts(data);
          setLoading(false);
        }
      } catch (err) {
        if (isMounted && !signal.aborted) {
          console.error("Erro ao carregar contadores:", err);
          setError(err instanceof Error ? err.message : "Erro desconhecido");
          setLoading(false);
        }
      }
    };
    
    fetchCounts();
    
    // Limpeza na desmontagem do componente
    return () => {
      isMounted = false;
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
                <Card key={dept} className="overflow-hidden">
                  <CardHeader className={`py-3 bg-${dept === 'gabarito' ? 'blue' : 
                    dept === 'impressao' ? 'violet' : 
                    dept === 'batida' ? 'amber' : 
                    dept === 'costura' ? 'emerald' : 
                    dept === 'embalagem' ? 'slate' : 'gray'}-600 text-white`}>
                    <CardTitle className="text-center text-base font-medium">
                      {departmentNames[dept as keyof typeof departmentNames]}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 text-center">
                    <span className="text-3xl font-bold">{count}</span>
                  </CardContent>
                </Card>
              ))}
            </div>

          </div>
        )}
      </CardContent>
    </Card>
  );
}