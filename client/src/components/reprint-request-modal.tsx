// MODO DEUS - Sistema de reimpressão 100% funcional
import { useState, useEffect } from "react";
import { Activity } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { queryClient } from "@/lib/queryClient";

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
  fromDepartment: z.string(),
  toDepartment: z.string(),
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
    activityId: activity ? activity.id : 0,
    requestedBy: "",
    reason: "",
    details: "",
    quantity: 1,
    priority: "normal",
    fromDepartment: "batida",
    toDepartment: "impressao",
  };

  const form = useForm<ReprintRequestFormValues>({
    resolver: zodResolver(reprintRequestFormSchema),
    defaultValues,
  });
  
  // Usar useEffect para atualizar o valor de activityId quando a prop activity mudar
  useEffect(() => {
    if (activity && form) {
      console.log("Atualizando ID da atividade para:", activity.id);
      form.setValue("activityId", activity.id);
    }
  }, [activity, form]);

  // Buscar atividades caso não tenha uma atividade específica
  const { data: activities = [], isLoading: isLoadingActivities } = useQuery<Activity[]>({
    queryKey: ["/api/activities"],
    enabled: !activity, // Só busca se não tiver atividade específica
  });

  // Função para lidar com o envio do formulário - VERSÃO MODO DEUS
  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    
    try {
      setIsSubmitting(true);
      
      // Garantir que temos uma atividade válida
      if (!activity) {
        throw new Error("Nenhuma atividade selecionada para reimpressão");
      }
      
      // Garantir que temos um ID válido
      if (!activity.id || isNaN(Number(activity.id))) {
        throw new Error("ID da atividade inválido ou não encontrado");
      }
      
      // Inicialização segura de dados
      const activityId = Number(activity.id);
      const formData = form.getValues();
      
      // Validar campos obrigatórios manualmente
      if (!formData.requestedBy || formData.requestedBy.trim() === "") {
        toast({
          title: "Campo obrigatório",
          description: "Informe quem está solicitando a reimpressão",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }
      
      if (!formData.reason || formData.reason.trim() === "") {
        toast({
          title: "Campo obrigatório",
          description: "Informe o motivo da reimpressão",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }
      
      // Preparar dados no formato exato que o backend espera
      const dataToSubmit = {
        activityId: activityId,
        requestedBy: formData.requestedBy.trim(),
        reason: formData.reason.trim(),
        details: (formData.details || "").trim(),
        quantity: formData.quantity ? parseInt(String(formData.quantity)) : 1,
        priority: formData.priority || "normal",
        fromDepartment: "batida",
        toDepartment: "impressao"
      };
      
      console.log("MODO DEUS - Dados sendo enviados:", JSON.stringify(dataToSubmit, null, 2));
      
      // Fazer a requisição com tratamento robusto de erro
      let response;
      try {
        response = await fetch("/api/reprint-requests", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(dataToSubmit),
          // Evitar cache e garantir conclusão da requisição
          cache: "no-cache",
          credentials: "same-origin",
        });
      } catch (networkError) {
        console.error("Erro de rede ao enviar solicitação:", networkError);
        throw new Error("Falha na conexão com o servidor. Verifique sua internet.");
      }
      
      // Capturar a resposta texto para diagnóstico completo
      let responseText;
      try {
        responseText = await response.text();
        console.log("MODO DEUS - Resposta completa do servidor:", responseText);
      } catch (readError) {
        console.error("Erro ao ler resposta do servidor:", readError);
        throw new Error("Falha ao processar resposta do servidor");
      }
      
      // Validar resposta HTTP
      if (!response.ok) {
        let errorMessage = `Erro ${response.status}: Falha ao enviar solicitação`;
        
        // Tentar extrair mensagem de erro do JSON
        try {
          const errorData = JSON.parse(responseText);
          errorMessage = errorData.message || errorMessage;
        } catch (parseError) {
          // Se não for JSON, usar o texto como está se tiver conteúdo
          if (responseText && responseText.trim() !== "") {
            errorMessage = responseText;
          }
        }
        
        console.error("MODO DEUS - Erro detalhado:", {
          status: response.status,
          statusText: response.statusText,
          errorMessage,
          responseText
        });
        
        throw new Error(errorMessage);
      }
      
      // Sucesso! Processar resultado
      let result;
      try {
        result = JSON.parse(responseText);
        console.log("MODO DEUS - Solicitação processada com sucesso:", result);
      } catch (parseError) {
        // Mesmo se não conseguirmos parsear o JSON, a requisição foi bem-sucedida
        console.log("Resposta não é JSON válido, mas requisição foi bem-sucedida");
      }
      
      // Atualizações de UI e limpeza
      queryClient.invalidateQueries({ queryKey: ['/api/reprint-requests/from-department/batida'] });
      
      // Exibir confirmação visual
      toast({
        title: "✅ Solicitação enviada com sucesso",
        description: "O setor de impressão foi notificado sobre sua solicitação de reimpressão.",
        variant: "default",
      });
      
      // Fechar o modal e limpar estado
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 500); // Pequeno delay para garantir que o usuário vê a confirmação
      
    } catch (error) {
      console.error("MODO DEUS - Erro capturado:", error);
      setIsSubmitting(false);
      
      // Garantir feedback claro para o usuário
      toast({
        title: "Erro ao enviar solicitação",
        description: error instanceof Error ? error.message : "Falha desconhecida ao conectar com o servidor",
        variant: "destructive",
      });
    }
  }

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
          <form onSubmit={handleSubmit} className="space-y-5">
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
                        {Array.isArray(activities) && activities.length > 0 && activities.map((act: Activity) => (
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