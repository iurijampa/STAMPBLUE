import React, { useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./ui/card";
import { toast } from "@/hooks/use-toast";
import { AlertCircle, CheckCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";

interface ReprintRequestData {
  activityId: number;
  requestedBy: string;
  reason: string;
  details?: string;
  quantity?: number;
}

interface SolucaoReimpressaoProps {
  activityId: number;
  activityTitle: string;
  onSuccess?: () => void;
}

export default function SolucaoReimpressao({ activityId, activityTitle, onSuccess }: SolucaoReimpressaoProps) {
  const [formData, setFormData] = useState<ReprintRequestData>({
    activityId,
    requestedBy: "",
    reason: "",
    details: "",
    quantity: 1,
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === "quantity" ? Number(value) : value
    }));
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validação básica
    if (!formData.requestedBy.trim()) {
      toast({
        title: "Erro de validação",
        description: "Informe quem está solicitando a reimpressão",
        variant: "destructive",
      });
      return;
    }
    
    if (!formData.reason.trim()) {
      toast({
        title: "Erro de validação",
        description: "Informe o motivo da reimpressão",
        variant: "destructive",
      });
      return;
    }
    
    try {
      setIsSubmitting(true);
      setStatus("idle");
      setErrorMessage("");
      
      console.log("Enviando solicitação:", formData);
      
      const response = await fetch("/api/reimpressao-simples", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.mensagem || "Erro ao processar solicitação");
      }
      
      console.log("Resposta:", result);
      
      // Sucesso
      setStatus("success");
      toast({
        title: "Solicitação enviada com sucesso",
        description: "O setor de impressão foi notificado da sua solicitação",
      });
      
      // Resetar form depois de alguns segundos
      setTimeout(() => {
        setFormData({
          activityId,
          requestedBy: "",
          reason: "",
          details: "",
          quantity: 1,
        });
        
        if (onSuccess) {
          onSuccess();
        }
      }, 3000);
      
    } catch (error) {
      console.error("Erro ao enviar solicitação:", error);
      setStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "Erro desconhecido");
      
      toast({
        title: "Erro ao enviar solicitação",
        description: error instanceof Error ? error.message : "Falha na comunicação com o servidor",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Solicitar Reimpressão - Modo Simples</CardTitle>
        <CardDescription>
          Solicitação para: {activityTitle} (ID: {activityId})
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        {status === "success" && (
          <Alert className="mb-4 bg-green-50 border-green-600">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-green-700">Solicitação Enviada!</AlertTitle>
            <AlertDescription className="text-green-700">
              Sua solicitação foi enviada com sucesso. O setor de impressão foi notificado.
            </AlertDescription>
          </Alert>
        )}
        
        {status === "error" && (
          <Alert className="mb-4" variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Erro ao processar solicitação</AlertTitle>
            <AlertDescription>
              {errorMessage || "Ocorreu um erro ao enviar sua solicitação. Tente novamente."}
            </AlertDescription>
          </Alert>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Solicitado por <span className="text-red-500">*</span>
            </label>
            <Input
              name="requestedBy"
              value={formData.requestedBy}
              onChange={handleChange}
              placeholder="Nome do responsável pela solicitação"
              disabled={isSubmitting || status === "success"}
              required
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Motivo da reimpressão <span className="text-red-500">*</span>
            </label>
            <Input
              name="reason"
              value={formData.reason}
              onChange={handleChange}
              placeholder="Ex: Peças com defeito na impressão"
              disabled={isSubmitting || status === "success"}
              required
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Detalhes adicionais
            </label>
            <Textarea
              name="details"
              value={formData.details}
              onChange={handleChange}
              placeholder="Descreva detalhes específicos sobre as peças que precisam ser reimpressas"
              disabled={isSubmitting || status === "success"}
              rows={3}
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Quantidade
            </label>
            <Input
              name="quantity"
              type="number"
              value={formData.quantity}
              onChange={handleChange}
              min={1}
              disabled={isSubmitting || status === "success"}
            />
          </div>
        </form>
      </CardContent>
      
      <CardFooter className="flex justify-end gap-3">
        <Button variant="outline">
          Cancelar
        </Button>
        <Button 
          onClick={handleSubmit} 
          disabled={isSubmitting || status === "success"}
        >
          {isSubmitting ? "Enviando..." : "Enviar Solicitação"}
        </Button>
      </CardFooter>
    </Card>
  );
}