import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { FileInput } from "@/components/ui/file-input";
import { apiRequest } from "@/lib/queryClient";
import { DEPARTMENTS } from "@shared/schema";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";

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
  const [quantity, setQuantity] = useState("");
  const [clientName, setClientName] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [priority, setPriority] = useState<string>("normal");
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [deadline, setDeadline] = useState<Date | undefined>(undefined);

  const handleAddDepartment = (department: string) => {
    if (!selectedDepartments.includes(department)) {
      setSelectedDepartments([...selectedDepartments, department]);
    }
  };

  const handleRemoveDepartment = (department: string) => {
    setSelectedDepartments(selectedDepartments.filter(dep => dep !== department));
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
      
      if (!deadline) {
        toast({
          title: "Erro ao criar atividade",
          description: "A data de entrega é obrigatória",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }
      
      const formData = {
        title,
        description,
        quantity: parseInt(quantity) || 0,
        clientName,
        image: imageData,
        priority,
        deadline,
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
      
      toast({
        title: "Atividade criada com sucesso",
      });
      
      // Resetar formulário
      setTitle("");
      setDescription("");
      setQuantity("");
      setClientName("");
      setImageFile(null);
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
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantidade</Label>
              <Input
                id="quantity"
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
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
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="image">Imagem (opcional)</Label>
            <FileInput
              value={imageFile}
              onChange={setImageFile}
              accept="image/*"
              maxSize={5 * 1024 * 1024} // 5MB
              placeholder="Selecione uma imagem..."
            />
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