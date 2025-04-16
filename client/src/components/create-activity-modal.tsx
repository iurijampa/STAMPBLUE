import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { FileInput } from "@/components/ui/file-input";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { DEPARTMENTS } from "@shared/schema";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, InfoIcon } from "lucide-react";

interface CreateActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreateActivityModal({ isOpen, onClose, onSuccess }: CreateActivityModalProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [clientName, setClientName] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [additionalImageFiles, setAdditionalImageFiles] = useState<File[]>([]);
  const [priority, setPriority] = useState<string>("normal");
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [initialDepartment, setInitialDepartment] = useState<string>("gabarito");
  const [deadline, setDeadline] = useState<Date | undefined>(undefined);

  const handleAddDepartment = (department: string) => {
    if (!selectedDepartments.includes(department)) {
      setSelectedDepartments([...selectedDepartments, department]);
    }
  };

  const handleRemoveDepartment = (department: string) => {
    setSelectedDepartments(selectedDepartments.filter(dep => dep !== department));
  };

  // Função auxiliar para lidar com o input de múltiplas imagens
  const handleAddImages = (files: File | File[] | null) => {
    if (!files) return;
    
    if (Array.isArray(files)) {
      // Múltiplos arquivos
      setAdditionalImageFiles(prev => [...prev, ...files]);
    } else if (files instanceof File) {
      // Arquivo único
      setAdditionalImageFiles(prev => [...prev, files]);
    }
  };

  const handleRemoveImage = (index: number) => {
    setAdditionalImageFiles(prev => prev.filter((_, i) => i !== index));
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (selectedDepartments.length === 0) {
      toast({
        title: "Erro ao criar atividade",
        description: "Selecione pelo menos um departamento",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    
    try {
      let imageData = null;
      if (imageFile) {
        imageData = await fileToBase64(imageFile);
      }
      
      // Converter todas as imagens adicionais para base64
      const additionalImagesData = [];
      for (const file of additionalImageFiles) {
        const base64Data = await fileToBase64(file);
        additionalImagesData.push(base64Data);
      }
      
      if (!deadline) {
        toast({
          title: "Erro ao criar atividade",
          description: "A data de entrega é obrigatória",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }
      
      // Convertendo a data para string ISO para o backend
      const formData = {
        title,
        description,
        quantity: 1, // Valor padrão já que não usamos mais a quantidade
        clientName,
        image: imageData,
        additionalImages: additionalImagesData,
        priority,
        deadline: deadline ? deadline.toISOString() : null,
        initialDepartment: initialDepartment, // Departamento inicial selecionado
        workflowSteps: selectedDepartments.map(department => ({
          department,
          order: selectedDepartments.indexOf(department) + 1,
        }))
      };
      
      const response = await apiRequest("POST", "/api/activities", formData);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Erro ao criar atividade");
      }
      
      // SOLUÇÃO RADICAL: Limpeza e forçamento de dados para resolver o problema de atualizações
      console.log("🚨 Forçando atualização após criação de novo pedido");
      
      // 1. Invalidar todas as consultas relevantes
      queryClient.invalidateQueries({ queryKey: ["/api/activities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/activities/em-producao"] });
      queryClient.invalidateQueries({ queryKey: ["/api/activities/concluidos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats/department-counts"] });
      
      // 2. Aguardar microtask para garantir que a invalidação aconteça
      await new Promise(resolve => setTimeout(resolve, 0));
      
      // 3. Forçar busca direta dos dados em vez de confiar na invalidação automática
      try {
        console.log("🔄 Buscando dados atualizados diretamente");
        
        // Buscar dados em produção diretamente
        const emProducaoResponse = await fetch("/api/activities/em-producao");
        if (emProducaoResponse.ok) {
          const emProducaoData = await emProducaoResponse.json();
          queryClient.setQueryData(["/api/activities/em-producao"], emProducaoData);
        }
        
        // Buscar todos os dados diretamente
        const todosResponse = await fetch("/api/activities");
        if (todosResponse.ok) {
          const todosData = await todosResponse.json();
          queryClient.setQueryData(["/api/activities"], todosData);
        }
        
        // Buscar estatísticas atualizadas
        const statsResponse = await fetch("/api/stats");
        if (statsResponse.ok) {
          const statsData = await statsResponse.json();
          queryClient.setQueryData(["/api/stats"], statsData);
        }
        
        // Buscar contagem por departamento
        const countsResponse = await fetch("/api/stats/department-counts");
        if (countsResponse.ok) {
          const countsData = await countsResponse.json();
          queryClient.setQueryData(["/api/stats/department-counts"], countsData);
        }
        
        console.log("✅ Dados atualizados com sucesso após criação de novo pedido");
      } catch (error) {
        console.error("❌ Erro ao forçar atualização dos dados:", error);
      }
      
      toast({
        title: "Atividade criada com sucesso",
      });
      
      // Resetar formulário
      setTitle("");
      setDescription("");
      setClientName("");
      setImageFile(null);
      setAdditionalImageFiles([]);
      setPriority("normal");
      setSelectedDepartments([]);
      setDeadline(undefined);
      
      onSuccess();
      onClose();
      
    } catch (error) {
      console.error("Erro ao criar atividade:", error);
      toast({
        title: "Erro ao criar atividade",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Nova Atividade</DialogTitle>
          <DialogDescription>
            Preencha os detalhes da nova atividade a ser criada. Adicione todos os departamentos
            que farão parte do fluxo de trabalho.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Título</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="clientName">Cliente</Label>
            <Input
              id="clientName"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="image">Imagem Principal</Label>
            <FileInput
              value={imageFile}
              onChange={(file) => {
                // Tratamento para garantir que apenas aceitamos arquivos únicos
                if (file instanceof File) {
                  setImageFile(file);
                } else if (file === null) {
                  setImageFile(null);
                }
              }}
              accept="image/*"
              maxSize={5 * 1024 * 1024} // 5MB
              placeholder="Selecione uma imagem principal..."
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="additionalImages">Imagens Adicionais</Label>
            <div className="flex items-center gap-2 mb-2">
              <FileInput
                multiple
                accept="image/*"
                maxSize={5 * 1024 * 1024} // 5MB
                placeholder="Adicionar imagens..."
                onChange={(files) => {
                  if (files && Array.isArray(files)) {
                    setAdditionalImageFiles(prev => [...prev, ...files]);
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => setAdditionalImageFiles([])}
                disabled={additionalImageFiles.length === 0}
                className="whitespace-nowrap"
              >
                Limpar Todas
              </Button>
            </div>
            
            <div className="bg-muted p-2 rounded-md min-h-[100px]">
              {additionalImageFiles.length === 0 ? (
                <p className="text-sm text-center text-muted-foreground p-4">
                  Adicione imagens adicionais ao pedido
                </p>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {additionalImageFiles.map((file, index) => (
                    <div key={index} className="relative group">
                      <div className="rounded-md overflow-hidden h-16 bg-background">
                        <img
                          src={URL.createObjectURL(file)}
                          alt={`Imagem adicional ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <button
                        type="button"
                        className="absolute top-0 right-0 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => {
                          const newFiles = [...additionalImageFiles];
                          newFiles.splice(index, 1);
                          setAdditionalImageFiles(newFiles);
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="priority">Prioridade</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a prioridade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Baixa</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="urgent">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="deadline">Data de Entrega</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={`w-full justify-start text-left font-normal ${!deadline && "text-muted-foreground"}`}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {deadline ? format(deadline, "PPP", { locale: ptBR }) : "Selecione uma data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={deadline}
                    onSelect={setDeadline}
                    initialFocus
                    locale={ptBR}
                    required
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="initialDepartment">Departamento Inicial</Label>
              <div className="relative group">
                <InfoIcon className="h-4 w-4 text-muted-foreground cursor-help" />
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 w-64 p-2 bg-background text-xs rounded-md shadow-md border border-border opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  O pedido começará diretamente a partir deste departamento, pulando os departamentos anteriores.
                </div>
              </div>
            </div>
            <Select value={initialDepartment} onValueChange={setInitialDepartment}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o departamento inicial" />
              </SelectTrigger>
              <SelectContent>
                {DEPARTMENTS.map((department) => (
                  <SelectItem key={department} value={department}>
                    {department.charAt(0).toUpperCase() + department.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label>Fluxo de Trabalho</Label>
            <p className="text-sm text-muted-foreground mb-2">
              Adicione os departamentos na ordem do fluxo de trabalho
            </p>
            
            <div className="flex gap-2 mb-2">
              <Select onValueChange={handleAddDepartment}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {DEPARTMENTS.map((department) => (
                    <SelectItem 
                      key={department} 
                      value={department}
                      disabled={selectedDepartments.includes(department)}
                    >
                      {department.charAt(0).toUpperCase() + department.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                onClick={() => setSelectedDepartments([])}
                disabled={selectedDepartments.length === 0}
              >
                Limpar
              </Button>
            </div>
            
            <div className="bg-muted p-2 rounded-md min-h-[100px]">
              {selectedDepartments.length === 0 ? (
                <p className="text-sm text-center text-muted-foreground p-4">
                  Adicione departamentos ao fluxo de trabalho
                </p>
              ) : (
                <ul className="space-y-2">
                  {selectedDepartments.map((department, index) => (
                    <li key={department} className="flex items-center justify-between p-2 bg-background rounded-md">
                      <div className="flex items-center gap-2">
                        <span className="bg-primary-200 text-primary-700 rounded-full w-6 h-6 flex items-center justify-center text-xs font-medium">
                          {index + 1}
                        </span>
                        <span>
                          {department.charAt(0).toUpperCase() + department.slice(1)}
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => handleRemoveDepartment(department)}
                      >
                        &times;
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Criando..." : "Criar Atividade"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}