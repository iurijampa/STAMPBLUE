import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { FileInput } from "@/components/ui/file-input";
import { apiRequest } from "@/lib/queryClient";
import { DEPARTMENTS, Activity } from "@shared/schema";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";

interface EditActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  activity: Activity | null;
}

export default function EditActivityModal({ isOpen, onClose, onSuccess, activity }: EditActivityModalProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [clientName, setClientName] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageData, setImageData] = useState<string | null>(null);
  const [additionalImageFiles, setAdditionalImageFiles] = useState<File[]>([]);
  const [additionalImagesData, setAdditionalImagesData] = useState<string[]>([]);
  const [priority, setPriority] = useState<string>("normal");
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [deadline, setDeadline] = useState<Date | undefined>(undefined);

  // Preencha o formulário com os dados da atividade quando ela for carregada
  useEffect(() => {
    if (activity) {
      setTitle(activity.title);
      setDescription(activity.description || "");
      setClientName(activity.clientName || "");
      setPriority(activity.priority || "normal");
      setImageData(activity.image || null);
      
      // Carrega as imagens adicionais, se existirem
      if (activity.additionalImages && Array.isArray(activity.additionalImages)) {
        setAdditionalImagesData(activity.additionalImages);
      } else {
        setAdditionalImagesData([]);
      }
      
      // Defina a data de entrega
      if (activity.deadline) {
        setDeadline(new Date(activity.deadline));
      }
      
      // Para simplificar, definimos um fluxo de trabalho padrão com todos os departamentos
      // Isso será substituído quando obtivermos o fluxo real de trabalho da API
      setSelectedDepartments([...DEPARTMENTS]);
    }
  }, [activity]);

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
    
    if (!activity) {
      toast({
        title: "Erro ao editar atividade",
        description: "Atividade não encontrada",
        variant: "destructive",
      });
      return;
    }
    
    if (selectedDepartments.length === 0) {
      toast({
        title: "Erro ao editar atividade",
        description: "Selecione pelo menos um departamento",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    
    try {
      // Processando a imagem principal
      let finalImageData = imageData;
      if (imageFile) {
        finalImageData = await fileToBase64(imageFile);
      }
      
      // Processando as imagens adicionais
      let finalAdditionalImages = [...additionalImagesData];
      
      // Convertendo novos arquivos de imagens adicionais para base64
      if (additionalImageFiles.length > 0) {
        const additionalImagesPromises = additionalImageFiles.map(file => fileToBase64(file));
        const newAdditionalImagesBase64 = await Promise.all(additionalImagesPromises);
        finalAdditionalImages = [...finalAdditionalImages, ...newAdditionalImagesBase64];
      }
      
      if (!deadline) {
        toast({
          title: "Erro ao editar atividade",
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
        quantity: 1, // Valor padrão fixo
        clientName,
        image: finalImageData,
        additionalImages: finalAdditionalImages,
        priority,
        deadline: deadline ? deadline.toISOString() : null,
        // Não enviamos workflowSteps aqui pois o backend não usa essa propriedade diretamente
        // O fluxo de trabalho é gerenciado separadamente pelo backend via activityProgress
        status: activity.status
      };
      
      const response = await apiRequest("PUT", `/api/activities/${activity.id}`, formData);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Erro ao editar atividade");
      }
      
      toast({
        title: "Atividade atualizada com sucesso",
      });
      
      onSuccess();
      onClose();
      
    } catch (error) {
      console.error("Erro ao editar atividade:", error);
      toast({
        title: "Erro ao editar atividade",
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
          <DialogTitle>Editar Atividade</DialogTitle>
          <DialogDescription>
            Edite os detalhes da atividade. Você pode modificar todos os campos,
            incluindo o fluxo de trabalho.
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
            {imageData && !imageFile && (
              <div className="mb-2">
                <p className="text-sm text-muted-foreground mb-2">Imagem atual:</p>
                <img 
                  src={imageData} 
                  alt="Imagem da atividade" 
                  className="h-24 object-cover rounded-md"
                />
              </div>
            )}
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
              placeholder="Selecione uma nova imagem principal..."
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="additionalImages">Imagens Adicionais</Label>
            
            {/* Exibir imagens adicionais existentes */}
            {additionalImagesData.length > 0 && (
              <div className="mb-4">
                <p className="text-sm text-muted-foreground mb-2">Imagens adicionais atuais:</p>
                <div className="grid grid-cols-4 gap-2">
                  {additionalImagesData.map((img, index) => (
                    <div key={index} className="relative group">
                      <img 
                        src={img} 
                        alt={`Imagem adicional ${index + 1}`} 
                        className="h-16 w-full object-cover rounded-md"
                      />
                      <button
                        type="button"
                        className="absolute top-0 right-0 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => {
                          const newImages = [...additionalImagesData];
                          newImages.splice(index, 1);
                          setAdditionalImagesData(newImages);
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Adicionar novas imagens */}
            <div className="flex items-center gap-2">
              <FileInput
                multiple
                accept="image/*"
                maxSize={5 * 1024 * 1024} // 5MB
                placeholder="Adicionar mais imagens..."
                onChange={(files) => {
                  if (files && Array.isArray(files)) {
                    setAdditionalImageFiles([...additionalImageFiles, ...files]);
                  }
                }}
              />
            </div>
            
            {/* Mostrar arquivos de imagens adicionais selecionados */}
            {additionalImageFiles.length > 0 && (
              <div className="mt-2">
                <p className="text-sm text-muted-foreground mb-2">Novas imagens a serem adicionadas:</p>
                <div className="grid grid-cols-4 gap-2">
                  {additionalImageFiles.map((file, index) => (
                    <div key={index} className="relative group">
                      <div className="h-16 w-full bg-muted rounded-md flex items-center justify-center text-xs text-muted-foreground overflow-hidden">
                        {file.name}
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
              </div>
            )}
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
            <Label>Fluxo de Trabalho</Label>
            <p className="text-sm text-muted-foreground mb-2">
              Fluxo de trabalho padrão (não pode ser alterado após a criação)
            </p>
            
            <div className="bg-muted p-2 rounded-md min-h-[100px]">
              {selectedDepartments.length === 0 ? (
                <p className="text-sm text-center text-muted-foreground p-4">
                  Fluxo de trabalho não definido
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
              {isLoading ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}