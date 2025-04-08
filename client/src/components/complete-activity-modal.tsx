import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Activity } from "@shared/schema";
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
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

// Form schema
const completionFormSchema = z.object({
  completedBy: z.string().min(1, { message: "Nome do funcionário é obrigatório" }),
  notes: z.string().optional(),
});

type CompletionFormValues = z.infer<typeof completionFormSchema>;

interface CompleteActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  activityId: number | null;
  onSuccess?: () => void;
}

export default function CompleteActivityModal({
  isOpen,
  onClose,
  activityId,
  onSuccess
}: CompleteActivityModalProps) {
  const { toast } = useToast();
  
  // Fetch activity details if needed
  const { data: activityData, isLoading: isLoadingActivity } = useQuery<Activity>({
    queryKey: [`/api/activities/${activityId}`],
    enabled: isOpen && !!activityId,
  });
  
  const form = useForm<CompletionFormValues>({
    resolver: zodResolver(completionFormSchema),
    defaultValues: {
      completedBy: "",
      notes: "",
    },
  });
  
  // Complete activity mutation
  const completeMutation = useMutation({
    mutationFn: async (values: CompletionFormValues) => {
      return await apiRequest("POST", `/api/activities/${activityId}/complete`, values);
    },
    onSuccess: () => {
      toast({
        title: "Atividade concluída",
        description: "A atividade foi marcada como concluída com sucesso.",
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
        title: "Erro",
        description: error.message || "Ocorreu um erro ao concluir a atividade.",
        variant: "destructive",
      });
    },
  });
  
  // Handle form submission
  const onSubmit = (values: CompletionFormValues) => {
    completeMutation.mutate(values);
  };
  
  // Reset form to initial state
  const resetForm = () => {
    form.reset({
      completedBy: "",
      notes: "",
    });
  };
  
  // Handle modal close
  const handleClose = () => {
    if (!completeMutation.isPending) {
      resetForm();
      onClose();
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Concluir Atividade</DialogTitle>
          <DialogDescription>
            Confirme a conclusão desta atividade informando quem a realizou.
          </DialogDescription>
        </DialogHeader>
        
        {isLoadingActivity ? (
          <div className="py-4 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {activityData && (
                <div className="mb-4">
                  <h3 className="font-medium text-neutral-800">{activityData.title}</h3>
                  <p className="text-sm text-neutral-600 mt-1">{activityData.description}</p>
                </div>
              )}
              
              <FormField
                control={form.control}
                name="completedBy"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome do Funcionário</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Digite o nome completo do funcionário" 
                        {...field} 
                      />
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
                    <FormLabel>Observações (opcional)</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Alguma observação sobre a atividade realizada..." 
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
                  disabled={completeMutation.isPending}
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit"
                  disabled={completeMutation.isPending}
                  className="bg-success-600 hover:bg-success-700"
                >
                  {completeMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Confirmar Conclusão
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
