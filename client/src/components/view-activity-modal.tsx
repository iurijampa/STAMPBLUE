import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Activity } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, X, Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ViewActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  activity: Activity | null;
}

export default function ViewActivityModal({ isOpen, onClose, activity }: ViewActivityModalProps) {
  const [imageZoom, setImageZoom] = useState(1);
  const [imageFullscreen, setImageFullscreen] = useState(false);
  
  if (!activity) return null;
  
  // Função para formatar a data
  const formatDate = (date: Date | null) => {
    if (!date) return "Sem data";
    return new Date(date).toLocaleDateString('pt-BR');
  };
  
  // Função para obter a cor do status
  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending": return "bg-yellow-500";
      case "in_progress": return "bg-blue-500";
      case "completed": return "bg-green-500";
      default: return "bg-gray-500";
    }
  };
  
  // Função para traduzir o status
  const translateStatus = (status: string) => {
    switch (status) {
      case "pending": return "Pendente";
      case "in_progress": return "Em Progresso";
      case "completed": return "Concluído";
      default: return status;
    }
  };
  
  // Manipuladores de zoom
  const zoomIn = () => setImageZoom(prev => Math.min(prev + 0.25, 3));
  const zoomOut = () => setImageZoom(prev => Math.max(prev - 0.25, 0.5));
  const resetZoom = () => setImageZoom(1);
  
  // Manipulador para alternar fullscreen
  const toggleFullscreen = () => {
    setImageFullscreen(!imageFullscreen);
    resetZoom();
  };
  
  return (
    <>
      {/* Modal de visualização principal */}
      <Dialog open={isOpen && !imageFullscreen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-xl">Detalhes da Atividade</DialogTitle>
          </DialogHeader>
          
          <div className="flex flex-col gap-6 py-4">
            {/* Título e Data de Entrega */}
            <div>
              <h3 className="text-xl font-semibold mb-2">{activity.title}</h3>
              <div className="text-sm text-neutral-700 mb-2">
                <span className="font-medium">Data de entrega:</span> {formatDate(activity.deadline)}
              </div>
            </div>
            
            {/* Imagem com controles de zoom */}
            <div className="flex flex-col space-y-3">
              <div className="relative overflow-hidden border rounded-md h-60 flex items-center justify-center bg-neutral-100">
                {activity.image ? (
                  <>
                    <div className="overflow-auto h-full w-full flex items-center justify-center">
                      <img 
                        src={activity.image} 
                        alt={`Imagem para ${activity.title}`} 
                        className="transition-transform duration-200"
                        style={{ transform: `scale(${imageZoom})` }} 
                      />
                    </div>
                    <div className="absolute top-2 right-2 flex space-x-1">
                      <Button 
                        size="sm" 
                        variant="secondary" 
                        className="h-8 w-8 p-0 rounded-full opacity-80 hover:opacity-100"
                        onClick={toggleFullscreen}
                      >
                        <Maximize2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </>
                ) : (
                  <span className="text-neutral-400">Nenhuma imagem disponível</span>
                )}
              </div>
              
              {activity.image && (
                <div className="flex items-center justify-center space-x-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={zoomOut}
                    disabled={imageZoom <= 0.5}
                  >
                    <ZoomOut className="h-4 w-4 mr-1" />
                    <span>Reduzir</span>
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={resetZoom}
                  >
                    <span>100%</span>
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={zoomIn}
                    disabled={imageZoom >= 3}
                  >
                    <ZoomIn className="h-4 w-4 mr-1" />
                    <span>Ampliar</span>
                  </Button>
                </div>
              )}
            </div>
            
            {/* Descrição */}
            <div>
              <h4 className="font-medium text-base mb-2">Descrição:</h4>
              <p className="text-neutral-700 whitespace-pre-line">{activity.description}</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Modal de visualização em tela cheia da imagem */}
      {imageFullscreen && activity.image && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90">
          <div className="relative w-full h-full overflow-auto flex items-center justify-center">
            <img 
              src={activity.image} 
              alt={`Imagem para ${activity.title}`} 
              className="max-h-full max-w-full transition-transform duration-200"
              style={{ transform: `scale(${imageZoom})` }} 
            />
            
            <div className="absolute top-4 right-4 flex space-x-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={zoomOut}
                disabled={imageZoom <= 0.5}
                className="bg-black bg-opacity-50 text-white border-neutral-600"
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              
              <Button 
                variant="outline" 
                size="sm" 
                onClick={resetZoom}
                className="bg-black bg-opacity-50 text-white border-neutral-600"
              >
                <span>100%</span>
              </Button>
              
              <Button 
                variant="outline" 
                size="sm" 
                onClick={zoomIn}
                disabled={imageZoom >= 3}
                className="bg-black bg-opacity-50 text-white border-neutral-600"
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
              
              <Button 
                variant="outline" 
                size="sm" 
                onClick={toggleFullscreen}
                className="bg-black bg-opacity-50 text-white border-neutral-600"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}