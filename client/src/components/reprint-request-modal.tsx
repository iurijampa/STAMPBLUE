import { useState } from "react";
import { Activity } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiRequest } from "@/lib/queryClient";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";

// Schema para validação do formulário
const reprintRequestFormSchema = z.object({
  activityId: z.number().min(1, "Selecione um pedido válido"),
  requestedBy: z.string().min(2, "Informe quem está solicitando"),
  reason: z.string().min(3, "Informe o motivo da reimpressão"),
  details: z.string().optional(),
  quantity: z.number().min(1, "Quantidade deve ser pelo menos 1"),
  priority: z.enum(["low", "normal", "high", "urgent"]),
});

type ReprintRequestFormValues = z.infer<typeof reprintRequestFormSchema>;

interface ReprintRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  activity: Activity | null;
  onSuccess: () => void;
}

export default function ReprintRequestModal({ isOpen, onClose, activity, onSuccess }: ReprintRequestModalProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Definir valores padrão para o formulário
  const defaultValues: Partial<ReprintRequestFormValues> = {
    activityId: activity?.id || 0,
    requestedBy: "",
    reason: "",
    details: "",
    quantity: 1,
    priority: "normal",
  };

  const form = useForm<ReprintRequestFormValues>({
    resolver: zodResolver(reprintRequestFormSchema),
    defaultValues,
  });

  // Buscar atividades caso não tenha uma atividade específica
  const { data: activities, isLoading: isLoadingActivities } = useQuery({
    queryKey: ["/api/activities"],
    enabled: !activity, // Só busca se não tiver atividade específica
  });

  // Mutação para criar solicitação de reimpressão
  const createMutation = useMutation({
    mutationFn: async (data: ReprintRequestFormValues) => {
      const response = await apiRequest("POST", "/api/reprint-requests", data);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Erro ao enviar solicitação");
      }
      
      return await response.json();
    },
    onSuccess: () => {
      setIsSubmitting(false);
      onSuccess();
      onClose();
    },
    onError: (error: Error) => {
      setIsSubmitting(false);
      toast({
        title: "Erro ao enviar solicitação",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Função para lidar com o envio do formulário
  const onSubmit = (values: ReprintRequestFormValues) => {
    setIsSubmitting(true);
    createMutation.mutate(values);
  };

  // Renderizar opções de prioridade
  const priorityOptions = [
    { value: "low", label: "Baixa" },
    { value: "normal", label: "Normal" },
    { value: "high", label: "Alta" },
    { value: "urgent", label: "Urgente" },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Nova Solicitação de Reimpressão</DialogTitle>
          <DialogDescription>
            Preencha os detalhes abaixo para solicitar a reimpressão de peças com problemas.
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            {!activity && (
              <FormField
                control={form.control}
                name="activityId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pedido</FormLabel>
                    <Select
                      disabled={isSubmitting || isLoadingActivities}
                      onValueChange={(value) => field.onChange(parseInt(value))}
                      defaultValue={field.value ? field.value.toString() : undefined}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o pedido" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {activities?.map((act) => (
                          <SelectItem key={act.id} value={act.id.toString()}>
                            {act.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="requestedBy"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Solicitado por</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Nome do responsável pela solicitação"
                      {...field}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Motivo da reimpressão</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ex: Peças com defeito na impressão"
                      {...field}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="details"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Detalhes adicionais</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Descreva detalhes específicos sobre as peças que precisam ser reimpressas"
                      className="resize-none"
                      {...field}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormDescription>
                    Detalhe os problemas específicos e requisitos para a reimpressão
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantidade</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        {...field}
                        onChange={e => field.onChange(parseInt(e.target.value))}
                        disabled={isSubmitting}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prioridade</FormLabel>
                    <Select
                      disabled={isSubmitting}
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a prioridade" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {priorityOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  "Enviar Solicitação"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}