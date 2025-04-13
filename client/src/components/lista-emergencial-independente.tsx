import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Info } from "lucide-react";

interface ListaEmergencialIndependenteProps {
  department: string;
  title?: string;
  description?: string;
}

/**
 * Componente vazio para manter compatibilidade
 * O sistema emergencial foi removido
 */
export default function ListaEmergencialIndependente({ 
  department,
  title = "Sistema de Reimpressão",
  description = "Sistema atualizado"
}: ListaEmergencialIndependenteProps) {
  return (
    <Card className="w-full mb-6">
      <CardHeader className="bg-blue-50 dark:bg-blue-900/20">
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="text-xl">
              {title}
            </CardTitle>
            <CardDescription>
              {description}
            </CardDescription>
          </div>
          <Badge variant="outline" className="bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-100">
            Atualizado
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="py-10 text-center text-muted-foreground">
          <Info className="h-8 w-8 mx-auto mb-2" />
          <p>O sistema emergencial de reimpressão foi substituído pelo sistema principal.</p>
          <p className="text-sm mt-1">Por favor, utilize o módulo principal de reimpressão.</p>
        </div>
      </CardContent>
    </Card>
  );
}