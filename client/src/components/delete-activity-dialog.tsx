import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { apiRequest } from "@/lib/queryClient";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface DeleteActivityDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  activityId: number | null;
  activityTitle: string;
}

export default function DeleteActivityDialog({
  isOpen,
  onClose,
  onSuccess,
  activityId,
  activityTitle,
}: DeleteActivityDialogProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const handleDelete = async () => {
    if (!activityId) return;

    setIsLoading(true);
    try {
      const response = await apiRequest("DELETE", `/api/activities/${activityId}`);
      
      if (!response.ok) {
        throw new Error("Erro ao excluir atividade");
      }
      
      toast({
        title: "Atividade excluída com sucesso",
      });
      
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Erro ao excluir atividade:", error);
      toast({
        title: "Erro ao excluir atividade",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
          <AlertDialogDescription>
            Você tem certeza que deseja excluir a atividade: <strong>{activityTitle}</strong>? 
            Esta ação não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancelar</AlertDialogCancel>
          <Button 
            variant="destructive" 
            onClick={handleDelete}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Excluindo...
              </>
            ) : (
              "Excluir"
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}