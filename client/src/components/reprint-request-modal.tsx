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

  // Função para lidar com o envio do formulário - VERSÃO MODO SUPER DEUS 9000
  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    
    try {
      setIsSubmitting(true);
      
      console.log("🔥 MODO SUPER DEUS 9000 ATIVADO 🔥");
      
      // Garantir que temos uma atividade válida
      if (!activity) {
        console.error("🔥 Erro: Nenhuma atividade selecionada");
        throw new Error("Nenhuma atividade selecionada para reimpressão");
      }
      
      // Garantir que temos um ID válido
      if (!activity.id || isNaN(Number(activity.id))) {
        console.error("🔥 Erro: ID inválido:", activity.id);
        throw new Error("ID da atividade inválido ou não encontrado");
      }
      
      console.log("🔥 Atividade validada:", activity.title, "(ID:", activity.id, ")");
      
      // Inicialização segura de dados
      const activityId = Number(activity.id);
      const formData = form.getValues();
      
      console.log("🔥 Dados do formulário:", formData);
      
      // Validar campos obrigatórios manualmente
      if (!formData.requestedBy || formData.requestedBy.trim() === "") {
        console.error("🔥 Erro: Campo requestedBy vazio");
        toast({
          title: "Campo obrigatório",
          description: "Informe quem está solicitando a reimpressão",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }
      
      if (!formData.reason || formData.reason.trim() === "") {
        console.error("🔥 Erro: Campo reason vazio");
        toast({
          title: "Campo obrigatório",
          description: "Informe o motivo da reimpressão",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }
      
      console.log("🔥 Validação de campos concluída com sucesso");
      
      // Preparar dados simplificados - reduzindo ao mínimo necessário
      const dataToSubmit = {
        activityId, // Enviar como número
        requestedBy: formData.requestedBy.trim(),
        reason: formData.reason.trim(),
        details: (formData.details || "").trim(),
        quantity: Number(formData.quantity || 1),
        priority: formData.priority || "normal",
      };
      
      console.log("🔥 Dados simplificados para envio:", JSON.stringify(dataToSubmit, null, 2));
      
      // Informar ao usuário que está processando
      toast({
        title: "Processando solicitação...",
        description: "Por favor, aguarde enquanto enviamos sua solicitação.",
        variant: "default",
      });
      
      // Fazer a requisição - abordagem de várias tentativas
      let success = false;
      let responseData = null;
      let errorMsg = "";
      let attempt = 0;
      const maxAttempts = 3;
      
      while (!success && attempt < maxAttempts) {
        attempt++;
        console.log(`🔥 Tentativa ${attempt} de ${maxAttempts}`);
        
        try {
          const response = await fetch("/api/reprint-requests", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(dataToSubmit),
            cache: "no-cache",
            credentials: "same-origin",
          });
          
          const responseText = await response.text();
          console.log(`🔥 Resposta (tentativa ${attempt}):`, responseText);
          
          if (response.ok) {
            try {
              responseData = JSON.parse(responseText);
              success = true;
              console.log("🔥 Sucesso! Dados:", responseData);
              break;
            } catch (e) {
              console.log("🔥 Resposta não é JSON válido, mas requisição foi bem-sucedida");
              success = true;
              break;
            }
          } else {
            errorMsg = `Erro ${response.status}: `;
            try {
              const errorData = JSON.parse(responseText);
              errorMsg += errorData.message || errorData.details || "Falha ao processar requisição";
            } catch (e) {
              errorMsg += responseText || "Falha ao processar requisição";
            }
            console.error(`🔥 Erro na tentativa ${attempt}:`, errorMsg);
            
            // Esperar antes da próxima tentativa
            if (attempt < maxAttempts) {
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }
        } catch (networkError) {
          console.error(`🔥 Erro de rede na tentativa ${attempt}:`, networkError);
          errorMsg = "Falha na conexão com o servidor. Verifique sua internet.";
          
          // Esperar antes da próxima tentativa
          if (attempt < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }
      
      // Verificar resultado final
      if (success) {
        console.log("🔥 SOLICITAÇÃO PROCESSADA COM SUCESSO APÓS", attempt, "TENTATIVAS");
        
        // Atualizar cache
        queryClient.invalidateQueries({ queryKey: ['/api/reprint-requests/from-department/batida'] });
        
        // Exibir confirmação visual
        toast({
          title: "✅ Solicitação enviada com sucesso",
          description: "O setor de impressão foi notificado sobre sua solicitação.",
          variant: "default",
        });
        
        // Fechar o modal e limpar estado
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1000);
      } else {
        throw new Error(`Todas as ${maxAttempts} tentativas falharam: ${errorMsg}`);
      }
      
    } catch (error) {
      console.error("🔥 ERRO CRÍTICO:", error);
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