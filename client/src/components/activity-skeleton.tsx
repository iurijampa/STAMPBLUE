import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Componente de esqueleto para exibir durante o carregamento de atividades
export function ActivitySkeleton() {
  return (
    <div className="space-y-4">
      {Array(3).fill(0).map((_, index) => (
        <div 
          key={index}
          className="border rounded-lg p-4 animate-pulse"
        >
          <div className="flex justify-between items-start">
            <div className="flex gap-4">
              {/* Miniatura da imagem */}
              <Skeleton className="w-16 h-16 min-w-16 rounded" />
              
              <div className="space-y-2">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-4 w-24" />
                <div className="flex gap-2 mt-2">
                  <Skeleton className="h-6 w-24" />
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-8 w-8 rounded-full" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Componente de esqueleto para as estatísticas
export function StatsSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-semibold">Atividades Pendentes</CardTitle>
          <div className="h-4 w-48">
            <Skeleton className="h-4 w-full" />
          </div>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-16" />
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-semibold">Atividades Concluídas</CardTitle>
          <div className="h-4 w-48">
            <Skeleton className="h-4 w-full" />
          </div>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-16" />
        </CardContent>
      </Card>
    </div>
  );
}