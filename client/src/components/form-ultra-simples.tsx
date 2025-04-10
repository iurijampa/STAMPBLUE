import React, { useState } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Label } from "./ui/label";
import { toast } from "@/hooks/use-toast";

export default function FormUltraSimples() {
  const [nomeResponsavel, setNomeResponsavel] = useState("");
  const [motivo, setMotivo] = useState("");
  const [detalhes, setDetalhes] = useState("");
  const [quantidade, setQuantidade] = useState("1");
  const [isLoading, setIsLoading] = useState(false);
  const [sucessoMensagem, setSucessoMensagem] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!nomeResponsavel.trim() || !motivo.trim()) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive"
      });
      return;
    }
    
    try {
      setIsLoading(true);
      
      console.log("Enviando dados:", {
        activityId: 49, // Fixo para teste
        requestedBy: nomeResponsavel,
        reason: motivo,
        details: detalhes,
        quantity: parseInt(quantidade)
      });
      
      const response = await fetch("/api/reimpressao-ultrabasico/criar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          activityId: 49, // Fixo para teste
          requestedBy: nomeResponsavel,
          reason: motivo,
          details: detalhes,
          quantity: parseInt(quantidade)
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.mensagem || "Erro ao enviar solicitação");
      }
      
      const data = await response.json();
      console.log("Resposta:", data);
      
      // Mostrar mensagem de sucesso
      setSucessoMensagem("Solicitação enviada com sucesso!");
      
      // Limpar formulário
      setNomeResponsavel("");
      setMotivo("");
      setDetalhes("");
      setQuantidade("1");
      
      toast({
        title: "Sucesso!",
        description: "Solicitação de reimpressão enviada com sucesso"
      });
      
      // Limpar mensagem de sucesso após 5 segundos
      setTimeout(() => {
        setSucessoMensagem("");
      }, 5000);
      
    } catch (error) {
      console.error("Erro:", error);
      toast({
        title: "Erro ao enviar solicitação",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Solicitar Reimpressão (Ultra Simples)</CardTitle>
      </CardHeader>
      
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {sucessoMensagem && (
            <div className="bg-green-50 text-green-600 p-3 rounded-md border border-green-200">
              ✅ {sucessoMensagem}
            </div>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="responsavel">Nome do Responsável *</Label>
            <Input
              id="responsavel"
              value={nomeResponsavel}
              onChange={(e) => setNomeResponsavel(e.target.value)}
              placeholder="Digite seu nome"
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="motivo">Motivo da Reimpressão *</Label>
            <Input
              id="motivo"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex: Falha na impressão, cor errada, etc."
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="detalhes">Detalhes Adicionais</Label>
            <Textarea
              id="detalhes"
              value={detalhes}
              onChange={(e) => setDetalhes(e.target.value)}
              placeholder="Descreva mais detalhes se necessário"
              rows={3}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="quantidade">Quantidade</Label>
            <Input
              id="quantidade"
              type="number"
              min="1"
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
            />
          </div>
        </CardContent>
        
        <CardFooter>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Enviando..." : "Enviar Solicitação"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}