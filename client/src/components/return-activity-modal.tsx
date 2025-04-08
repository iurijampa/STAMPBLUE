import React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Activity } from "@shared/schema";

// Schema de validação para o formulário
const returnFormSchema = z.object({
  returnedBy: z.string().min(1, {
    message: "Por favor, informe o seu nome",
  }),
  notes: z.string().optional(),
});

// Tipo inferido do schema
type ReturnFormValues = z.infer<typeof returnFormSchema>;

interface ReturnActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  activityId: number | null;
  onSuccess?: () => void;
}

export default function ReturnActivityModal({
  isOpen,
  onClose,
  activityId,
  onSuccess
}: ReturnActivityModalProps) {
  const { toast } = useToast();
  
  // Fetch activity details if needed
  const { data: activityData, isLoading: isLoadingActivity } = useQuery<Activity>({
    queryKey: [`/api/activities/${activityId}`],
    enabled: isOpen && !!activityId,
  });
  
  const form = useForm<ReturnFormValues>({
    resolver: zodResolver(returnFormSchema),
    defaultValues: {
      returnedBy: "",
      notes: "",
    },
  });
  
  // Return activity mutation
  const returnMutation = useMutation({
    mutationFn: async (values: ReturnFormValues) => {
      return await apiRequest("POST", `/api/activities/${activityId}/return`, values);
    },
    onSuccess: () => {
      toast({
        title: "Pedido retornado",
        description: "O pedido foi retornado ao setor anterior com sucesso.",
      });
      
      // Invalidate queries to refresh activities list
      queryClient.invalidateQueries({ queryKey: ["/api/activities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/activities/department"] });
      queryClient.invalidateQueries({ queryKey: ["/api/department"] });
      
      // Call onSuccess callback if provided
      if (onSuccess) {
        onSuccess();
      }
      
      // Reset form and close modal
      resetForm();
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao retornar pedido",
        description: error.message || "Ocorreu um erro ao tentar retornar o pedido. Tente novamente.",
        variant: "destructive",
      });
    },
  });
  
  const onSubmit = (values: ReturnFormValues) => {
    returnMutation.mutate(values);
  };
  
  const resetForm = () => {
    form.reset({
      returnedBy: "",
      notes: "",
    });
  };
  
  // Quando o modal é fechado, resetar o formulário
  React.useEffect(() => {
    if (!isOpen) {
      resetForm();
    }
  }, [isOpen]);
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <RotateCcw className="h-5 w-5 mr-2 text-yellow-500" />
            Retornar Pedido
          </DialogTitle>
          <DialogDescription>
            Retorna este pedido ao setor anterior para ser reprocessado.
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="returnedBy"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Seu nome</FormLabel>
                  <FormControl>
                    <Input placeholder="Digite seu nome" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Motivo do retorno (opcional)</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Descreva o motivo pelo qual o pedido está sendo retornado" 
                      {...field} 
                      value={field.value || ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {activityData && (
              <div className="rounded-md bg-yellow-50 p-3 text-sm text-yellow-800">
                <p className="font-medium">Atenção:</p>
                <p>
                  Ao retornar o pedido "{activityData.title}", ele voltará para o setor anterior 
                  e não será mais visível no seu departamento até que seja corrigido e reenviado.
                </p>
              </div>
            )}
            
            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={onClose}
                disabled={returnMutation.isPending}
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={returnMutation.isPending || isLoadingActivity}
                className="gap-2"
              >
                {returnMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <RotateCcw className="h-4 w-4" />
                    Retornar Pedido
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}