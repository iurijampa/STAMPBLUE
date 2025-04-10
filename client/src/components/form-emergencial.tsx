import { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, AlertTriangle, CheckCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Activity {
  id: number;
  title: string;
  client: string;
  description: string;
}

interface FormEmergencialProps {
  activity: Activity;
  onSuccess?: () => void;
}

export default function FormEmergencial({ activity, onSuccess }: FormEmergencialProps) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestedBy, setRequestedBy] = useState("");
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [quantity, setQuantity] = useState("1");
  
  const { toast } = useToast();
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validação básica
    if (!requestedBy.trim()) {
      setError("Informe seu nome");
      return;
    }
    
    if (!reason.trim()) {
      setError("Informe o motivo da reimpressão");
      return;
    }
    
    if (isNaN(Number(quantity)) || Number(quantity) < 1) {
      setError("Quantidade inválida");
      return;
    }
    
    // Resetar estado
    setError(null);
    setLoading(true);
    
    try {
      // Usando nossa nova API emergencial integrada diretamente no servidor
      const response = await fetch("/api/reimpressao-emergencial/criar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          activityId: activity.id,
          requestedBy: requestedBy.trim(),
          reason: reason.trim(),
          details: details.trim(),
          quantity: parseInt(quantity)
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Erro ao enviar solicitação");
      }
      
      const data = await response.json();
      console.log("✅ Solicitação criada com sucesso:", data);
      
      // Sucesso
      setSuccess(true);
      toast({
        title: "Solicitação enviada!",
        description: "Sua solicitação de reimpressão foi enviada com sucesso para a Impressão.",
      });
      
      // Resetar form
      setRequestedBy("");
      setReason("");
      setDetails("");
      setQuantity("1");
      
      // Callback
      if (onSuccess) {
        onSuccess();
      }
      
    } catch (err) {
      console.error("❌ Erro ao enviar solicitação:", err);
      setError(err instanceof Error ? err.message : "Erro desconhecido");
      
      toast({
        title: "Erro ao enviar solicitação",
        description: err instanceof Error ? err.message : "Ocorreu um erro ao enviar sua solicitação",
        variant: "destructive",
      });
      
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <Card className="w-full">
      <CardHeader className="bg-green-50 dark:bg-green-900/20">
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="text-xl">Solicitação de Reimpressão Ultra Rápida</CardTitle>
            <CardDescription>Modo Emergencial - Direto para Impressão</CardDescription>
          </div>
          <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
            NOVO
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="order-info">Pedido</Label>
              <div id="order-info" className="p-3 bg-muted rounded-md">
                <div className="font-medium">{activity.title}</div>
                <div className="text-sm text-muted-foreground">{activity.client}</div>
                <div className="text-xs mt-1 text-muted-foreground">{activity.description}</div>
              </div>
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="requestedBy">Seu nome *</Label>
              <Input 
                id="requestedBy" 
                value={requestedBy}
                onChange={(e) => setRequestedBy(e.target.value)}
                placeholder="Digite seu nome"
                disabled={loading || success}
                required
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="reason">Motivo da reimpressão *</Label>
              <Input 
                id="reason" 
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ex: Falha na impressão, cor incorreta, etc."
                disabled={loading || success}
                required
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="details">Detalhes adicionais</Label>
              <Textarea 
                id="details" 
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Informe detalhes adicionais se necessário"
                disabled={loading || success}
                rows={3}
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="quantity">Quantidade</Label>
              <Input 
                id="quantity" 
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                disabled={loading || success}
                className="w-24"
              />
            </div>
            
            {error && (
              <div className="bg-red-50 text-red-800 p-3 rounded-md flex items-center gap-2 dark:bg-red-900/20 dark:text-red-300">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm">{error}</span>
              </div>
            )}
            
            {success && (
              <div className="bg-green-50 text-green-800 p-3 rounded-md flex items-center gap-2 dark:bg-green-900/20 dark:text-green-300">
                <CheckCircle className="h-4 w-4" />
                <span className="text-sm">Solicitação enviada com sucesso!</span>
              </div>
            )}
          </div>
        </form>
      </CardContent>
      
      <CardFooter className="flex justify-end gap-2 border-t pt-6">
        <Button 
          type="submit" 
          onClick={handleSubmit}
          disabled={loading || success}
          className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-800 dark:hover:bg-blue-700"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Enviando...
            </>
          ) : success ? (
            <>
              <CheckCircle className="mr-2 h-4 w-4" />
              Enviado
            </>
          ) : (
            "Enviar solicitação"
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}