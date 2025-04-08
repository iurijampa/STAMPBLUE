import React, { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Activity, ActivityProgress } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, X, Maximize2, Loader2, RotateCw, RefreshCw, Printer } from "lucide-react";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { 
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger 
} from "@/components/ui/accordion";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";

interface ViewActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  activity: Activity | null;
}

export default function ViewActivityModal({ isOpen, onClose, activity }: ViewActivityModalProps) {
  const [imageZoom, setImageZoom] = useState(1);
  const [imageFullscreen, setImageFullscreen] = useState(false);
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [progressHistory, setProgressHistory] = useState<ActivityProgress[]>([]);
  const [loadingProgress, setLoadingProgress] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ role: string } | null>(null);
  const [userLoading, setUserLoading] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const pdfContentRef = useRef<HTMLDivElement>(null);
  
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
  // Definir a imagem atual quando a atividade muda
  useEffect(() => {
    if (activity && activity.image) {
      setCurrentImage(activity.image);
    }
  }, [activity]);

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
  
  // Função para gerar o PDF
  const handlePrintPDF = async () => {
    if (!activity) return;
    
    try {
      setIsPrinting(true);
      
      // Criar o PDF formato A4
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });
      
      // Dimensões de página A4 em pontos
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      
      // Adicionar título ao PDF
      pdf.setFontSize(16);
      pdf.setTextColor(0, 0, 100); // Azul da Stamp Blue
      pdf.text('STAMP BLUE', pageWidth / 2, 15, { align: 'center' });
      pdf.setFontSize(14);
      pdf.setTextColor(0, 0, 0);
      pdf.text('Detalhe de Pedido', pageWidth / 2, 25, { align: 'center' });
      
      // Adicionar linha horizontal
      pdf.setDrawColor(200, 200, 200);
      pdf.line(20, 30, pageWidth - 20, 30);
      
      // Adicionar informações do pedido
      pdf.setFontSize(12);
      pdf.text(`Pedido: ${activity.title}`, 20, 40);
      pdf.text(`Data de entrega: ${formatDate(activity.deadline)}`, 20, 48);
      
      // Adicionar descrição
      pdf.setFontSize(11);
      pdf.text('Descrição:', 20, 60);
      
      // Função para quebrar texto em linhas
      const splitText = pdf.splitTextToSize(activity.description, pageWidth - 40);
      pdf.text(splitText, 20, 68);
      
      let currentY = 68 + (splitText.length * 7); // Espaço para a descrição
      
      // Adicionar status atual
      currentY += 10;
      pdf.setFillColor(240, 240, 240);
      pdf.rect(20, currentY - 5, pageWidth - 40, 10, 'F');
      pdf.setFontSize(11);
      pdf.text(`Status atual: ${translateStatus(activity.status)}`, 20, currentY);
      
      // Adicionar imagem principal
      if (activity.image) {
        try {
          currentY += 20;
          pdf.text('Imagem principal do pedido:', 20, currentY);
          currentY += 8;
          
          // Calcular dimensões para a imagem
          const maxImageWidth = pageWidth - 40; // Margens laterais
          const maxImageHeight = 80; // Altura máxima para a imagem
          
          // Adicionar a imagem principal
          pdf.addImage(
            activity.image, 
            'JPEG', 
            20, 
            currentY,
            maxImageWidth,
            maxImageHeight,
            undefined,
            'FAST'
          );
          
          currentY += maxImageHeight + 10;
          
          // Adicionar imagens adicionais se houver (máximo 2 para não sobrecarregar o PDF)
          if (activity.additionalImages && activity.additionalImages.length > 0) {
            pdf.text('Imagens adicionais:', 20, currentY);
            currentY += 8;
            
            // Limitar a 2 imagens adicionais para não tornar o PDF muito grande
            const maxAdditionalImages = Math.min(2, activity.additionalImages.length);
            const additionalImagesWidth = (maxImageWidth - 10) / maxAdditionalImages; // Largura com espaçamento
            
            for (let i = 0; i < maxAdditionalImages; i++) {
              try {
                pdf.addImage(
                  activity.additionalImages[i],
                  'JPEG',
                  20 + (i * (additionalImagesWidth + 5)),
                  currentY,
                  additionalImagesWidth,
                  60,
                  undefined,
                  'FAST'
                );
              } catch (additionalImgError) {
                console.error(`Erro ao adicionar imagem adicional ${i+1}:`, additionalImgError);
              }
            }
            
            // Se houver mais imagens, informar
            if (activity.additionalImages.length > maxAdditionalImages) {
              currentY += 70;
              pdf.text(`* Há mais ${activity.additionalImages.length - maxAdditionalImages} imagens disponíveis no sistema`, 20, currentY);
            }
            
            currentY += 80;
          }
        } catch (imgError) {
          console.error('Erro ao adicionar imagem principal:', imgError);
          currentY += 5;
          pdf.text('* Não foi possível carregar a imagem do pedido', 20, currentY);
          currentY += 10;
        }
      }
      
      // Adicionar informações de departamento, se houver progressos
      if (progressHistory.length > 0) {
        currentY += 10;
        pdf.text('Histórico de progresso:', 20, currentY);
        currentY += 8;
        
        // Adicionar tabela com cabeçalho
        pdf.setFillColor(220, 220, 220);
        pdf.rect(20, currentY - 5, pageWidth - 40, 10, 'F');
        pdf.text('Departamento', 25, currentY);
        pdf.text('Responsável', 80, currentY);
        pdf.text('Data', pageWidth - 40, currentY, { align: 'right' });
        currentY += 8;
        
        // Adicionar linhas da tabela
        const completedProgressItems = progressHistory
          .filter(p => p.completedAt !== null)
          .sort((a, b) => {
            if (!a.completedAt || !b.completedAt) return 0;
            return new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime();
          });
          
        completedProgressItems.forEach((progress, index) => {
          const bgColor = index % 2 === 0 ? 245 : 255;
          pdf.setFillColor(bgColor, bgColor, bgColor);
          pdf.rect(20, currentY - 5, pageWidth - 40, 10, 'F');
          
          const deptName = progress.department.charAt(0).toUpperCase() + progress.department.slice(1);
          pdf.text(deptName, 25, currentY);
          pdf.text(progress.completedBy || 'Não informado', 80, currentY);
          
          const dateText = progress.completedAt ? formatDate(progress.completedAt) : '-';
          pdf.text(dateText, pageWidth - 40, currentY, { align: 'right' });
          
          currentY += 10;
          
          // Adicionar notas se houver
          if (progress.notes) {
            pdf.setFontSize(9);
            pdf.text(`Obs: ${progress.notes}`, 30, currentY);
            pdf.setFontSize(11);
            currentY += 8;
          }
        });
      }
      
      // Informações de retorno, se o pedido foi retornado
      if ((activity as any).wasReturned) {
        currentY += 10;
        pdf.setFillColor(255, 240, 240); // Fundo levemente vermelho
        pdf.rect(20, currentY - 5, pageWidth - 40, 25, 'F');
        
        pdf.setTextColor(180, 0, 0); // Texto vermelho
        pdf.setFontSize(11);
        pdf.text('PEDIDO RETORNADO', 25, currentY);
        pdf.text(`Retornado por: ${(activity as any).returnedBy || 'Não informado'}`, 25, currentY + 8);
        
        if ((activity as any).returnNotes) {
          pdf.text(`Motivo: ${(activity as any).returnNotes}`, 25, currentY + 16);
        }
        
        pdf.setTextColor(0, 0, 0); // Restaurar cor do texto
        currentY += 30;
      }
      
      // Adicionar rodapé
      pdf.setFontSize(8);
      pdf.setTextColor(100, 100, 100);
      const today = new Date().toLocaleDateString('pt-BR');
      pdf.text(`Gerado em ${today} | Stamp Blue 2025 | Desenvolvido por Iuri`, pageWidth / 2, pageHeight - 10, { align: 'center' });
      
      // Salvar o PDF
      pdf.save(`${activity.title || 'pedido'}.pdf`);
      
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
    } finally {
      setIsPrinting(false);
    }
  };
  
  return (
    <>
      {/* Modal de visualização principal */}
      <Dialog open={isOpen && !imageFullscreen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-3xl">
          <DialogHeader className="flex flex-row justify-between items-center">
            <DialogTitle className="text-xl">Detalhes da Atividade</DialogTitle>
            <Button
              onClick={handlePrintPDF}
              variant="outline"
              className="gap-2"
              disabled={isPrinting}
            >
              {isPrinting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Gerando PDF...
                </>
              ) : (
                <>
                  <Printer className="h-4 w-4" />
                  Imprimir Pedido
                </>
              )}
            </Button>
          </DialogHeader>
          
          <div ref={pdfContentRef} className="flex flex-col gap-6 py-4">
            {/* Título e Data de Entrega */}
            <div>
              <h3 className="text-xl font-semibold mb-2">{activity.title}</h3>
              <div className="text-sm text-neutral-700 mb-2">
                <span className="font-medium">Data de entrega:</span> {formatDate(activity.deadline)}
              </div>
              
              {/* Informações de retorno de pedido, caso exista */}
              {(activity as any).wasReturned && (
                <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-md">
                  <h4 className="text-red-600 font-medium">Pedido retornado</h4>
                  <p className="text-sm text-red-700">
                    <span className="font-medium">Retornado por:</span> {(activity as any).returnedBy || 'Não informado'}
                  </p>
                  {(activity as any).returnNotes && (
                    <p className="text-sm text-red-700">
                      <span className="font-medium">Motivo:</span> {(activity as any).returnNotes}
                    </p>
                  )}
                  {(activity as any).returnedAt && (
                    <p className="text-sm text-red-700">
                      <span className="font-medium">Data:</span> {formatDate((activity as any).returnedAt)}
                    </p>
                  )}
                </div>
              )}
            </div>
            
            {/* Imagem com controles de zoom avançados */}
            <div className="flex flex-col space-y-3">
              <div className="relative overflow-hidden border rounded-md h-60 bg-neutral-100">
                {currentImage ? (
                  <>
                    <div className="h-full w-full">
                      <TransformWrapper
                        initialScale={1}
                        minScale={0.5}
                        maxScale={5}
                        centerOnInit
                        wheel={{ step: 0.05 }}
                      >
                        {({ zoomIn, zoomOut, resetTransform }) => (
                          <>
                            <TransformComponent
                              wrapperClass="h-full w-full"
                              contentClass="flex items-center justify-center"
                            >
                              <img 
                                src={currentImage} 
                                alt={`Imagem para ${activity.title}`}
                                className="max-h-60 max-w-full object-contain"
                              />
                            </TransformComponent>
                            <div className="absolute bottom-2 left-2 flex space-x-1 z-10 pdf-hide">
                              <Button 
                                size="sm" 
                                variant="secondary" 
                                className="h-7 w-7 p-0 rounded-full opacity-80 hover:opacity-100"
                                onClick={() => zoomOut()}
                              >
                                <ZoomOut className="h-3 w-3" />
                              </Button>
                              <Button 
                                size="sm" 
                                variant="secondary" 
                                className="h-7 w-7 p-0 rounded-full opacity-80 hover:opacity-100"
                                onClick={() => resetTransform()}
                              >
                                <RefreshCw className="h-3 w-3" />
                              </Button>
                              <Button 
                                size="sm" 
                                variant="secondary" 
                                className="h-7 w-7 p-0 rounded-full opacity-80 hover:opacity-100"
                                onClick={() => zoomIn()}
                              >
                                <ZoomIn className="h-3 w-3" />
                              </Button>
                            </div>
                          </>
                        )}
                      </TransformWrapper>
                    </div>
                    <div className="absolute top-2 right-2 flex space-x-1 z-10 pdf-hide">
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
                  <span className="text-neutral-400 flex h-full items-center justify-center">Nenhuma imagem disponível</span>
                )}
              </div>
              
              {/* Miniaturas de imagens adicionais */}
              {activity.additionalImages && activity.additionalImages.length > 0 && (
                <div className="pdf-hide">
                  <h4 className="text-sm font-medium mb-2">Imagens adicionais:</h4>
                  <div className="grid grid-cols-5 gap-2">
                    {/* Miniatura da imagem principal */}
                    <div 
                      className={`relative overflow-hidden h-14 rounded-md cursor-pointer border-2 ${currentImage === activity.image ? 'border-primary' : 'border-transparent'}`} 
                      onClick={() => setCurrentImage(activity.image)}
                    >
                      <img 
                        src={activity.image} 
                        alt="Imagem principal" 
                        className="w-full h-full object-cover"
                      />
                    </div>
                    
                    {/* Miniaturas das imagens adicionais */}
                    {activity.additionalImages.map((img, index) => (
                      <div 
                        key={index}
                        className={`relative overflow-hidden h-14 rounded-md cursor-pointer border-2 ${currentImage === img ? 'border-primary' : 'border-transparent'}`}
                        onClick={() => setCurrentImage(img)}
                      >
                        <img 
                          src={img} 
                          alt={`Imagem adicional ${index + 1}`} 
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Dicas de uso foram removidas para não atrapalhar visualização em dispositivos móveis */}
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
                  <div className="flex items-center justify-center py-8 pdf-hide">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    <span className="ml-2 text-neutral-600">Carregando histórico...</span>
                  </div>
                ) : progressHistory.length > 0 ? (
                  <div className="border rounded-md overflow-hidden">
                    <Accordion type="single" collapsible defaultValue="criacao" className="w-full">
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
                                  : (() => {
                                      const nextDept = progressHistory.find(p => p.completedAt === null)?.department;
                                      if (!nextDept) return 'Indefinido';
                                      return nextDept.charAt(0).toUpperCase() + nextDept.slice(1);
                                    })()
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
      
      {/* Modal de visualização em tela cheia da imagem com zoom avançado */}
      {imageFullscreen && currentImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90">
          <div className="relative w-full h-full">
            <TransformWrapper
              initialScale={1}
              minScale={0.1}
              maxScale={8}
              centerOnInit
              limitToBounds={false}
              wheel={{ step: 0.1 }}
            >
              {({ zoomIn, zoomOut, resetTransform, centerView }) => (
                <>
                  <TransformComponent
                    wrapperClass="w-full h-full"
                    contentClass="flex items-center justify-center h-full"
                  >
                    <img 
                      src={currentImage} 
                      alt={`Imagem para ${activity.title}`} 
                      className="max-h-[95vh] max-w-[95vw] object-contain"
                    />
                  </TransformComponent>
                  
                  {/* Controles de zoom posicionados no canto inferior */}
                  <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex space-x-3 z-50">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => zoomOut()}
                      className="bg-black bg-opacity-50 text-white border-neutral-600 hover:bg-black hover:bg-opacity-70"
                    >
                      <ZoomOut className="h-4 w-4 mr-1" />
                      <span>Reduzir</span>
                    </Button>
                    
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => {
                        resetTransform();
                        centerView();
                      }}
                      className="bg-black bg-opacity-50 text-white border-neutral-600 hover:bg-black hover:bg-opacity-70"
                    >
                      <RefreshCw className="h-4 w-4 mr-1" />
                      <span>Centralizar</span>
                    </Button>
                    
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => zoomIn()}
                      className="bg-black bg-opacity-50 text-white border-neutral-600 hover:bg-black hover:bg-opacity-70"
                    >
                      <ZoomIn className="h-4 w-4 mr-1" />
                      <span>Ampliar</span>
                    </Button>
                  </div>
                </>
              )}
            </TransformWrapper>
            
            {/* Botão para fechar o modo de tela cheia */}
            <div className="absolute top-4 right-4 z-50">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={toggleFullscreen}
                className="bg-black bg-opacity-50 text-white border-neutral-600 hover:bg-black hover:bg-opacity-70"
              >
                <X className="h-5 w-5 mr-1" />
                <span>Fechar</span>
              </Button>
            </div>
            
            {/* Instruções de uso removidas para não atrapalhar visualização em dispositivos móveis */}
          </div>
        </div>
      )}
    </>
  );
}