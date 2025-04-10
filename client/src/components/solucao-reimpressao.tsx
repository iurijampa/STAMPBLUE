import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { toast } from "@/hooks/use-toast";
import { Printer, AlertCircle } from "lucide-react";

interface SolucaoReimpressaoProps {
  activityId: number;
  activityTitle: string;
  onSuccess?: () => void;
}

export default function SolucaoReimpressao({ 
  activityId, 
  activityTitle,
  onSuccess
}: SolucaoReimpressaoProps) {
  const [requestedBy, setRequestedBy] = useState("");
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [isLoading, setIsLoading] = useState(false);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validação simples
    if (!requestedBy.trim()) {
      toast({
        title: "Erro de validação",
        description: "Informe quem está solicitando a reimpressão",
        variant: "destructive"
      });
      return;
    }
    
    if (!reason.trim()) {
      toast({
        title: "Erro de validação",
        description: "Informe o motivo da reimpressão",
        variant: "destructive"
      });
      return;
    }
    
    const quantityNum = parseInt(quantity);
    if (isNaN(quantityNum) || quantityNum < 1) {
      toast({
        title: "Erro de validação",
        description: "A quantidade deve ser um número positivo",
        variant: "destructive"
      });
      return;
    }
    
    try {
      setIsLoading(true);
      
      // Enviar solicitação para API emergencial
      console.log("Enviando solicitação para API EMERGENCIAL:", {
        activityId,
        requestedBy,
        reason,
        details: details.trim() || "",
        quantity: quantityNum
      });
      
      const response = await fetch("/api/reimpressao-emergencial/criar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          activityId,
          requestedBy,
          reason,
          details: details.trim() || "",
          quantity: quantityNum
        }),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.message || "Erro ao criar solicitação");
      }
      
      // Limpar formulário
      setRequestedBy("");
      setReason("");
      setDetails("");
      setQuantity("1");
      
      // Notificar sucesso
      toast({
        title: "Solicitação criada",
        description: "Sua solicitação de reimpressão foi enviada com sucesso",
      });
      
      // Chamar callback de sucesso se fornecido
      if (onSuccess) {
        onSuccess();
      }
      
    } catch (error) {
      console.error("Erro ao enviar solicitação:", error);
      toast({
        title: "Erro ao criar solicitação",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <form onSubmit={handleSubmit}>
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5" />
            <span>Solicitar Reimpressão</span>
          </CardTitle>
          <CardDescription>
            Faça uma solicitação de reimpressão para o pedido {activityId} - {activityTitle}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="bg-blue-50 p-3 rounded-md border border-blue-100 mb-2">
            <h3 className="text-sm font-medium text-blue-800 mb-1">Informação</h3>
            <p className="text-sm text-blue-700">
              Esta solicitação será enviada ao setor de impressão para reimpressão das peças com problemas.
            </p>
          </div>
          
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="requestedBy">Solicitado por</Label>
              <Input
                id="requestedBy"
                placeholder="Seu nome"
                value={requestedBy}
                onChange={(e) => setRequestedBy(e.target.value)}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantidade</Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                placeholder="Quantidade a ser reimpressa"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="reason">Motivo da reimpressão</Label>
            <Input
              id="reason"
              placeholder="Ex: Cor errada, falha na impressão, etc."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="details">Detalhes adicionais (opcional)</Label>
            <Textarea
              id="details"
              placeholder="Forneça mais detalhes sobre o problema, se necessário"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={3}
            />
          </div>
        </CardContent>
        
        <CardFooter className="flex justify-end space-x-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setRequestedBy("");
              setReason("");
              setDetails("");
              setQuantity("1");
            }}
            disabled={isLoading}
          >
            Limpar
          </Button>
          
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Enviando..." : "Enviar Solicitação"}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}