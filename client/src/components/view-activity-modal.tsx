import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Activity, ActivityProgress } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, X, Maximize2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { 
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger 
} from "@/components/ui/accordion";

interface ViewActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  activity: Activity | null;
}

export default function ViewActivityModal({ isOpen, onClose, activity }: ViewActivityModalProps) {
  const [imageZoom, setImageZoom] = useState(1);
  const [imageFullscreen, setImageFullscreen] = useState(false);
  const [progressHistory, setProgressHistory] = useState<ActivityProgress[]>([]);
  const [loadingProgress, setLoadingProgress] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ role: string } | null>(null);
  const [userLoading, setUserLoading] = useState(false);
  
  // Buscar o usuário atual
  useEffect(() => {
    async function fetchCurrentUser() {
      if (isOpen) {
        try {
          setUserLoading(true);
          const response = await fetch('/api/user', {
            credentials: 'include'
          });
          
          if (response.ok) {
            const userData = await response.json();
            setCurrentUser(userData);
          } else {
            console.error('Erro ao buscar usuário:', response.status);
          }
        } catch (error) {
          console.error('Erro ao buscar usuário:', error);
        } finally {
          setUserLoading(false);
        }
      }
    }
    
    fetchCurrentUser();
  }, [isOpen]);
  
  // Buscar o histórico de progresso quando o modal é aberto (apenas para admin)
  useEffect(() => {
    async function fetchActivityProgress() {
      if (activity && isOpen && currentUser && currentUser.role === 'admin') {
        try {
          setLoadingProgress(true);
          const response = await fetch(`/api/activities/${activity.id}/progress`, {
            credentials: 'include'
          });
          
          if (response.ok) {
            const data = await response.json();
            setProgressHistory(Array.isArray(data) ? data : []);
          } else {
            console.error('Erro ao buscar histórico:', response.status);
          }
        } catch (error) {
          console.error('Erro ao buscar histórico:', error);
        } finally {
          setLoadingProgress(false);
        }
      }
    }
    
    fetchActivityProgress();
  }, [activity, isOpen, currentUser]);
  
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
            
            {/* Histórico de progresso - apenas para administradores */}
            {currentUser && currentUser.role === 'admin' && (
              <div>
                <h4 className="font-medium text-base mb-2">Histórico de Progresso:</h4>
                
                {loadingProgress ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    <span className="ml-2 text-neutral-600">Carregando histórico...</span>
                  </div>
                ) : progressHistory.length > 0 ? (
                  <div className="border rounded-md overflow-hidden">
                    <Accordion type="single" collapsible className="w-full">
                      {/* Entrada de criação (inicial) */}
                      <AccordionItem value="criacao" className="border-b">
                        <AccordionTrigger className="hover:bg-neutral-50 px-4 py-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="bg-purple-500 text-white">
                              Criação
                            </Badge>
                            <span className="font-medium">Pedido criado</span>
                            <span className="text-xs text-neutral-500 ml-auto">
                              {formatDate(activity.createdAt)}
                            </span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-4 py-2 bg-neutral-50">
                          <div className="space-y-2">
                            <p><span className="font-medium">Criado por:</span> Admin</p>
                            {activity.notes && (
                              <p><span className="font-medium">Observações:</span> {activity.notes}</p>
                            )}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                      
                      {/* Progresso por departamentos */}
                      {progressHistory
                        .filter(p => p.completedAt !== null)
                        .sort((a, b) => {
                          if (!a.completedAt || !b.completedAt) return 0;
                          return new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime();
                        })
                        .map((progress, index) => (
                          <AccordionItem key={progress.id} value={String(progress.id)} className="border-b">
                            <AccordionTrigger className="hover:bg-neutral-50 px-4 py-2">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className={`bg-green-500 text-white`}>
                                  {progress.department.charAt(0).toUpperCase() + progress.department.slice(1)}
                                </Badge>
                                <span className="font-medium">Concluído</span>
                                <span className="text-xs text-neutral-500 ml-auto">
                                  {progress.completedAt ? formatDate(progress.completedAt) : '-'}
                                </span>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent className="px-4 py-2 bg-neutral-50">
                              <div className="space-y-2">
                                <p><span className="font-medium">Departamento:</span> {progress.department.charAt(0).toUpperCase() + progress.department.slice(1)}</p>
                                <p><span className="font-medium">Concluído por:</span> {progress.completedBy || 'Não informado'}</p>
                                {progress.notes && (
                                  <p><span className="font-medium">Observações:</span> {progress.notes}</p>
                                )}
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        ))
                      }
                      
                      {/* Status atual */}
                      <AccordionItem value="current" className="border-b">
                        <AccordionTrigger className="hover:bg-neutral-50 px-4 py-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={`${getStatusColor(activity.status)} text-white`}>
                              Status Atual
                            </Badge>
                            <span className="font-medium">{translateStatus(activity.status)}</span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-4 py-2 bg-neutral-50">
                          <div className="space-y-2">
                            <p>
                              <span className="font-medium">Situação:</span> {activity.status === 'completed' 
                                ? 'Pedido finalizado' 
                                : activity.status === 'in_progress' 
                                  ? 'Em andamento' 
                                  : 'Aguardando processamento'
                              }
                            </p>
                            {progressHistory.length > 0 ? (
                              <p>
                                <span className="font-medium">Próximo departamento:</span>{' '}
                                {activity.status === 'completed' 
                                  ? 'Nenhum (finalizado)' 
                                  : progressHistory.find(p => p.completedAt === null)?.department
                                    ? (progressHistory.find(p => p.completedAt === null)?.department.charAt(0).toUpperCase() + 
                                       progressHistory.find(p => p.completedAt === null)?.department.slice(1))
                                    : 'Indefinido'
                                }
                              </p>
                            ) : null}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  </div>
                ) : (
                  <div className="text-center py-4 border rounded-md bg-neutral-50">
                    <p className="text-neutral-500">Nenhum histórico de progresso disponível.</p>
                  </div>
                )}
              </div>
            )}
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