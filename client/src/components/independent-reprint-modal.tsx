import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, Upload } from "lucide-react";

interface IndependentReprintModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function IndependentReprintModal({
  isOpen,
  onClose,
  onSuccess,
}: IndependentReprintModalProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    requestedBy: "",
    quantity: "1",
    priority: "normal",
    details: "",
    reason: ""
  });
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setSelectedImage(file);
      
      // Criar uma URL para visualização
      const previewUrl = URL.createObjectURL(file);
      setImagePreview(previewUrl);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Validar campos obrigatórios
      if (!formData.title.trim()) {
        throw new Error("O título do pedido é obrigatório");
      }
      if (!formData.requestedBy.trim()) {
        throw new Error("O nome do solicitante é obrigatório");
      }
      if (!formData.reason.trim()) {
        throw new Error("O motivo da reimpressão é obrigatório");
      }

      // Preparar FormData para upload de imagem junto com outros dados
      const submitData = new FormData();
      submitData.append("title", formData.title);
      submitData.append("description", formData.description);
      submitData.append("requestedBy", formData.requestedBy);
      submitData.append("quantity", formData.quantity);
      submitData.append("priority", formData.priority);
      submitData.append("details", formData.details || "");
      submitData.append("reason", formData.reason);
      submitData.append("department", user?.department || "batida");
      
      // Adicionar a imagem se existir
      if (selectedImage) {
        submitData.append("image", selectedImage);
      }

      console.log("Enviando dados para reimpressão independente:", {
        title: formData.title,
        description: formData.description,
        requestedBy: formData.requestedBy,
        quantity: formData.quantity,
        priority: formData.priority,
        details: formData.details || "",
        reason: formData.reason,
      });

      // Enviar solicitação para o backend
      const response = await fetch("/api/reprint-requests/independent", {
        method: "POST",
        body: submitData,
        credentials: "include"
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Erro ao criar solicitação de reimpressão");
      }

      // Exibir mensagem de sucesso
      toast({
        title: "Solicitação enviada com sucesso",
        description: "Sua solicitação de reimpressão foi enviada ao setor de impressão",
        variant: "default",
      });

      // Limpar formulário e fechar modal
      setFormData({
        title: "",
        description: "",
        requestedBy: "",
        quantity: "1",
        priority: "normal",
        details: "",
        reason: ""
      });
      setSelectedImage(null);
      setImagePreview(null);
      
      // Chamar callback de sucesso, se fornecido
      if (onSuccess) {
        onSuccess();
      }
      
      onClose();
    } catch (error) {
      toast({
        title: "Erro ao enviar solicitação",
        description: error instanceof Error ? error.message : "Ocorreu um erro inesperado",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Solicitação de Reimpressão</DialogTitle>
          <DialogDescription>
            Preencha os dados para solicitar uma reimpressão ao setor de impressão.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="grid gap-4">
            <div className="grid grid-cols-1 gap-3">
              <Label htmlFor="title">Título do Pedido*</Label>
              <Input
                id="title"
                name="title"
                placeholder="Ex: Camiseta Azul 10 unidades"
                value={formData.title}
                onChange={handleInputChange}
                required
              />
            </div>

            <div className="grid grid-cols-1 gap-3">
              <Label htmlFor="description">Descrição do Pedido</Label>
              <Textarea
                id="description"
                name="description"
                placeholder="Detalhes do pedido..."
                value={formData.description}
                onChange={handleInputChange}
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 gap-3">
              <Label htmlFor="requestedBy">Nome do Funcionário*</Label>
              <Input
                id="requestedBy"
                name="requestedBy"
                placeholder="Nome de quem está solicitando"
                value={formData.requestedBy}
                onChange={handleInputChange}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-3">
                <Label htmlFor="quantity">Quantidade</Label>
                <Input
                  id="quantity"
                  name="quantity"
                  type="number"
                  min="1"
                  value={formData.quantity}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="grid gap-3">
                <Label htmlFor="priority">Prioridade</Label>
                <Select
                  value={formData.priority}
                  onValueChange={(value) => handleSelectChange("priority", value)}
                >
                  <SelectTrigger id="priority">
                    <SelectValue placeholder="Selecione a prioridade" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Baixa</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                    <SelectItem value="urgent">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <Label htmlFor="reason">Motivo da Reimpressão*</Label>
              <Textarea
                id="reason"
                name="reason"
                placeholder="Explique o motivo da necessidade de reimpressão..."
                value={formData.reason}
                onChange={handleInputChange}
                rows={3}
                required
              />
            </div>

            <div className="grid grid-cols-1 gap-3">
              <Label htmlFor="details">Detalhes Técnicos</Label>
              <Textarea
                id="details"
                name="details"
                placeholder="Especificações técnicas, se necessário..."
                value={formData.details}
                onChange={handleInputChange}
                rows={2}
              />
            </div>

            <div className="grid grid-cols-1 gap-3">
              <Label htmlFor="image">Imagem de Referência</Label>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <Input
                    id="image"
                    name="image"
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="cursor-pointer"
                  />
                </div>
                {imagePreview && (
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      setSelectedImage(null);
                      setImagePreview(null);
                    }}
                  >
                    Remover
                  </Button>
                )}
              </div>

              {/* Visualização da imagem selecionada */}
              {imagePreview && (
                <div className="mt-2 border rounded-md overflow-hidden max-h-48 flex items-center justify-center">
                  <img
                    src={imagePreview}
                    alt="Imagem de referência"
                    className="max-w-full max-h-48 object-contain"
                  />
                </div>
              )}
            </div>
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
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Enviar Solicitação
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}