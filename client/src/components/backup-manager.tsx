import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Download, Save, ChevronDown, ChevronUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getQueryFn, apiRequest, queryClient } from "@/lib/queryClient";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

type Backup = {
  date: string;
  file: string;
};

type BackupsByTable = Record<string, Backup[]>;

type BackupResponse = {
  status: "success" | "warning" | "error";
  message: string;
  backups: BackupsByTable;
};

export default function BackupManager() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<string>("users");
  const [isOpen, setIsOpen] = useState(false);
  
  // Obter a lista de backups
  const { data, isLoading, isError } = useQuery<BackupResponse>({
    queryKey: ["/api/backup"],
    queryFn: getQueryFn({ on401: "throw" }),
  });
  
  // Mutation para criar um novo backup
  const createBackupMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/backup");
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Backup iniciado",
        description: "O backup foi iniciado com sucesso e será concluído em breve.",
      });
      
      // Atualizar a lista de backups após 2 segundos (tempo para o backup ser concluído)
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/backup"] });
      }, 2000);
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao criar backup",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Função para formatar data
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };
  
  // Se ainda estiver carregando
  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Sistema de Backup</CardTitle>
          <CardDescription>Gerenciamento de backups automáticos do sistema</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center items-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="ml-2">Carregando backups...</p>
        </CardContent>
      </Card>
    );
  }
  
  // Se houver erro
  if (isError) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Sistema de Backup</CardTitle>
          <CardDescription>Gerenciamento de backups automáticos do sistema</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-destructive/10 p-4 rounded-md text-destructive">
            <p>Erro ao carregar os backups. Tente novamente mais tarde.</p>
          </div>
        </CardContent>
        <CardFooter>
          <Button 
            onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/backup"] })}
            variant="outline"
          >
            Tentar novamente
          </Button>
        </CardFooter>
      </Card>
    );
  }
  
  // Renderizar os backups
  const tables = Object.keys(data?.backups || {});
  
  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className="w-full"
    >
      <Card className="w-full">
        <CardHeader className="pb-3">
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Sistema de Backup</CardTitle>
              <CardDescription>O sistema realiza backups automáticos a cada hora</CardDescription>
            </div>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-9 p-0">
                {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
          </div>
        </CardHeader>
        
        <CollapsibleContent>
          <CardContent>
            {tables.length === 0 ? (
              <div className="bg-muted p-4 rounded-md">
                <p>Nenhum backup encontrado. Clique em "Criar backup manual" para gerar seu primeiro backup.</p>
              </div>
            ) : (
              <>
                <div className="mb-4">
                  <Tabs defaultValue={activeTab} onValueChange={setActiveTab}>
                    <TabsList className="mb-4">
                      {tables.map((table) => (
                        <TabsTrigger key={table} value={table}>
                          {table.charAt(0).toUpperCase() + table.slice(1)}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                    
                    {tables.map((table) => (
                      <TabsContent key={table} value={table}>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Data e hora</TableHead>
                              <TableHead>Arquivo</TableHead>
                              <TableHead className="w-[100px]">Ações</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {data?.backups[table]?.map((backup, index) => (
                              <TableRow key={index}>
                                <TableCell>{backup.date ? formatDate(backup.date) : '-'}</TableCell>
                                <TableCell className="font-mono text-xs truncate max-w-[200px]">
                                  {backup.file}
                                </TableCell>
                                <TableCell>
                                  <Button variant="ghost" size="icon">
                                    <Download className="h-4 w-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TabsContent>
                    ))}
                  </Tabs>
                </div>
                
                <div className="text-sm text-muted-foreground mt-4">
                  <p>O sistema mantém até 30 backups por tabela, removendo automaticamente os mais antigos.</p>
                </div>
              </>
            )}
          </CardContent>
        </CollapsibleContent>
        
        <CardFooter className="flex justify-between">
          <div className="text-sm text-muted-foreground">
            Último backup: {
              tables.length > 0 && data?.backups && data.backups[tables[0]] && data.backups[tables[0]].length > 0 && data.backups[tables[0]][0].date
                ? formatDate(data.backups[tables[0]][0].date)
                : "Nenhum backup realizado"
            }
          </div>
          <Button 
            onClick={() => createBackupMutation.mutate()}
            disabled={createBackupMutation.isPending}
          >
            {createBackupMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Criando backup...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Criar backup manual
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </Collapsible>
  );
}