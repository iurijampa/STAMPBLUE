import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from "@/components/ui/form";
import { FileInput } from "@/components/ui/file-input";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { CalendarIcon, Loader2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

// Form schema
const activityFormSchema = z.object({
  title: z.string().min(1, { message: "Título é obrigatório" }),
  description: z.string().min(1, { message: "Descrição é obrigatória" }),
  quantity: z.coerce.number().min(1, { message: "Quantidade deve ser pelo menos 1" }),
  deadline: z.date().optional(),
  notes: z.string().optional(),
});

type ActivityFormValues = z.infer<typeof activityFormSchema>;

interface CreateActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  activityId?: number | null;
}

export default function CreateActivityModal({ 
  isOpen, 
  onClose,
  activityId
}: CreateActivityModalProps) {
  const { toast } = useToast();
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const isEditing = !!activityId;
  
  // Fetch activity details for editing
  const { data: activityData, isLoading: isLoadingActivity } = useQuery({
    queryKey: [`/api/activities/${activityId}`],
    enabled: isOpen && isEditing,
  });
  
  const form = useForm<ActivityFormValues>({
    resolver: zodResolver(activityFormSchema),
    defaultValues: {
      title: "",
      description: "",
      quantity: 1,
      notes: "",
    },
  });
  
  // Update form values when editing an existing activity
  useEffect(() => {
    if (activityData && isEditing) {
      form.reset({
        title: activityData.title,
        description: activityData.description,
        quantity: activityData.quantity,
        deadline: activityData.deadline ? new Date(activityData.deadline) : undefined,
        notes: activityData.notes || "",
      });
      
      // Set image preview for existing activity
      if (activityData.image) {
        setImagePreview(activityData.image);
      }
    }
  }, [activityData, isEditing, form]);
  
  // Create or update activity mutation
  const activityMutation = useMutation({
    mutationFn: async (values: ActivityFormValues & { image: string }) => {
      if (isEditing) {
        return await apiRequest("PUT", `/api/activities/${activityId}`, values);
      } else {
        return await apiRequest("POST", "/api/activities", values);
      }
    },
    onSuccess: () => {
      toast({
        title: isEditing ? "Atividade atualizada" : "Atividade criada",
        description: isEditing 
          ? "A atividade foi atualizada com sucesso." 
          : "A atividade foi criada com sucesso.",
      });
      
      // Invalidate queries to refresh activities list
      queryClient.invalidateQueries({ queryKey: ["/api/activities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      
      // Reset form and close modal
      resetForm();
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message || "Ocorreu um erro. Tente novamente.",
        variant: "destructive",
      });
    },
  });
  
  // Convert image file to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };
  
  // Handle form submission
  const onSubmit = async (values: ActivityFormValues) => {
    // Validate image
    if (!imageFile && !imagePreview) {
      setImageError("A imagem é obrigatória");
      return;
    }
    
    let imageBase64 = imagePreview;
    
    // If there's a new image file, convert it to base64
    if (imageFile) {
      try {
        imageBase64 = await fileToBase64(imageFile);
      } catch (error) {
        setImageError("Erro ao processar a imagem");
        return;
      }
    }
    
    // Submit form with image
    activityMutation.mutate({
      ...values,
      image: imageBase64 as string,
    });
  };
  
  // Reset form to initial state
  const resetForm = () => {
    form.reset({
      title: "",
      description: "",
      quantity: 1,
      deadline: undefined,
      notes: "",
    });
    setImageFile(null);
    setImagePreview(null);
    setImageError(null);
  };
  
  // Handle modal close
  const handleClose = () => {
    if (!activityMutation.isPending) {
      resetForm();
      onClose();
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Atividade" : "Nova Atividade"}</DialogTitle>
          <DialogDescription>
            {isEditing 
              ? "Atualize os detalhes da atividade abaixo." 
              : "Preencha os detalhes da nova atividade de produção."}
          </DialogDescription>
        </DialogHeader>
        
        {isEditing && isLoadingActivity ? (
          <div className="py-8 flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Título da Atividade</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Ex: Camisa Polo - Modelo XYZ" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrição</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Detalhes sobre o produto a ser produzido..." 
                        className="min-h-[100px]"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div>
                <FormLabel>Imagem do Produto</FormLabel>
                <FileInput 
                  value={imageFile}
                  onChange={(file) => {
                    setImageFile(file);
                    setImageError(null);
                  }}
                  accept="image/*"
                  maxSize={2 * 1024 * 1024} // 2MB
                  placeholder="Arraste e solte uma imagem ou clique para selecionar"
                  error={imageError || undefined}
                />
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <FormField
                  control={form.control}
                  name="quantity"
                  render={({ field }) => (
                    <FormItem className="w-full sm:w-1/2">
                      <FormLabel>Quantidade</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min={1}
                          placeholder="Ex: 100" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="deadline"
                  render={({ field }) => (
                    <FormItem className="w-full sm:w-1/2">
                      <FormLabel>Prazo</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? (
                                format(field.value, "dd/MM/yyyy")
                              ) : (
                                <span>Selecione uma data</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) => date < new Date()}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observações Adicionais</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Informações adicionais para os setores..." 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter className="mt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  disabled={activityMutation.isPending}
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit"
                  disabled={activityMutation.isPending}
                >
                  {activityMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {isEditing ? "Atualizar Atividade" : "Criar Atividade"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
