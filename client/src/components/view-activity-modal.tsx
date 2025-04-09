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
  
  // Função para gerar o PDF com layout melhorado
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
      
      // Margens reduzidas
      const marginLeft = 10;
      const marginRight = 10;
      const contentWidth = pageWidth - marginLeft - marginRight;
      
      // Adicionar título ao PDF
      pdf.setFontSize(16);
      pdf.setTextColor(0, 0, 100); // Azul da Stamp Blue
      pdf.text('STAMP BLUE', pageWidth / 2, 15, { align: 'center' });
      pdf.setFontSize(14);
      pdf.setTextColor(0, 0, 0);
      pdf.text('Detalhe de Pedido', pageWidth / 2, 25, { align: 'center' });
      
      // Adicionar linha horizontal
      pdf.setDrawColor(200, 200, 200);
      pdf.line(marginLeft, 30, pageWidth - marginRight, 30);
      
      // Adicionar informações do pedido - com destaque para número e data
      pdf.setFontSize(12);
      
      // Título do pedido com número em negrito
      pdf.setFont('helvetica', 'bold');
      pdf.text('Pedido:', marginLeft, 40);
      pdf.setFont('helvetica', 'normal');
      pdf.text(` ${activity.title}`, marginLeft + 35, 40);
      
      // Data de entrega com destaque para a data
      pdf.setFont('helvetica', 'bold');
      pdf.text('Data de entrega:', marginLeft, 48);
      pdf.setFont('helvetica', 'normal');
      pdf.text(` ${formatDate(activity.deadline)}`, marginLeft + 70, 48);
      
      // Nome do cliente logo abaixo da data de entrega (movido para cá)
      if (activity.clientName) {
        pdf.setFont('helvetica', 'bold');
        pdf.text('Cliente:', marginLeft, 56);
        pdf.setFont('helvetica', 'normal');
        pdf.text(` ${activity.clientName}`, marginLeft + 35, 56);
      }
      
      // Adicionar descrição e imagem lado a lado quando possível
      pdf.setFontSize(11);
      
      // Início da área de descrição e imagem
      let startY = 60;
      
      if (activity.image) {
        try {
          // Verificar o tamanho da descrição para determinar o layout
          const descriptionLines = pdf.splitTextToSize(activity.description, contentWidth * 0.5); // Metade da largura para descrição
          
          // Se a descrição for longa (mais de 5 linhas), usamos layout em coluna
          const isLongDescription = descriptionLines.length > 5;
          
          if (isLongDescription) {
            // LAYOUT PARA DESCRIÇÃO LONGA: Imagem à direita, texto à esquerda
            
            // Adicionamos a descrição à esquerda
            pdf.setFont('helvetica', 'bold');
            pdf.text('Descrição:', marginLeft, startY);
            pdf.setFont('helvetica', 'normal');
            
            // Texto da descrição ocupa 60% da largura
            const textWidth = contentWidth * 0.58;
            const splitText = pdf.splitTextToSize(activity.description, textWidth);
            pdf.text(splitText, marginLeft, startY + 8);
            
            // Imagem à direita
            const imageX = marginLeft + textWidth + 5; // 5mm de espaço entre texto e imagem
            const imageWidth = contentWidth * 0.38; // Imagem ocupa 38% da largura
            const imageHeight = 80; // Altura fixa para a imagem
            
            pdf.setFont('helvetica', 'bold');
            pdf.text('Imagem:', imageX, startY);
            
            // Adicionar a imagem com proporção preservada
            pdf.addImage(
              activity.image, 
              'JPEG', 
              imageX, 
              startY + 8,
              imageWidth,
              imageHeight,
              undefined,
              'FAST'
            );
            
            // Atualizar a posição Y após o maior elemento (texto ou imagem)
            const textEndY = startY + 8 + (splitText.length * 5);
            const imageEndY = startY + 8 + imageHeight;
            let currentY = Math.max(textEndY, imageEndY) + 15;
            
            // Adicionar imagens adicionais se houver
            if (activity.additionalImages && activity.additionalImages.length > 0) {
              pdf.setFont('helvetica', 'bold');
              pdf.text('Imagens adicionais:', marginLeft, currentY);
              pdf.setFont('helvetica', 'normal');
              currentY += 8;
              
              // Limitar a 2 imagens adicionais
              const maxAdditionalImages = Math.min(2, activity.additionalImages.length);
              const additionalImagesWidth = (contentWidth - 10) / maxAdditionalImages;
              
              for (let i = 0; i < maxAdditionalImages; i++) {
                try {
                  pdf.addImage(
                    activity.additionalImages[i],
                    'JPEG',
                    marginLeft + (i * (additionalImagesWidth + 5)),
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
                pdf.text(`* Há mais ${activity.additionalImages.length - maxAdditionalImages} imagens disponíveis no sistema`, marginLeft, currentY);
              }
              
              currentY += 80;
            }
          } else {
            // LAYOUT PARA DESCRIÇÃO CURTA: Descrição primeiro, imagem abaixo
            
            pdf.setFont('helvetica', 'bold');
            pdf.text('Descrição:', marginLeft, startY);
            pdf.setFont('helvetica', 'normal');
            
            // Com descrição curta, texto ocupa toda a largura
            const splitText = pdf.splitTextToSize(activity.description, contentWidth);
            pdf.text(splitText, marginLeft, startY + 8);
            
            let currentY = startY + 8 + (splitText.length * 5) + 15;
            
            // Adicionar imagem principal abaixo do texto
            pdf.setFont('helvetica', 'bold');
            pdf.text('Imagem principal do pedido:', marginLeft, currentY);
            pdf.setFont('helvetica', 'normal');
            currentY += 8;
            
            // Dimensões para a imagem - deixamos maior quando está abaixo do texto
            const maxImageWidth = contentWidth;
            const maxImageHeight = 100;
            
            pdf.addImage(
              activity.image, 
              'JPEG', 
              marginLeft, 
              currentY,
              maxImageWidth,
              maxImageHeight,
              undefined,
              'FAST'
            );
            
            currentY += maxImageHeight + 10;
            
            // Adicionar imagens adicionais se houver
            if (activity.additionalImages && activity.additionalImages.length > 0) {
              pdf.setFont('helvetica', 'bold');
              pdf.text('Imagens adicionais:', marginLeft, currentY);
              pdf.setFont('helvetica', 'normal');
              currentY += 8;
              
              // Limitar a 3 imagens adicionais quando estão abaixo do texto
              const maxAdditionalImages = Math.min(3, activity.additionalImages.length);
              const additionalImagesWidth = (contentWidth - 10) / maxAdditionalImages;
              
              for (let i = 0; i < maxAdditionalImages; i++) {
                try {
                  pdf.addImage(
                    activity.additionalImages[i],
                    'JPEG',
                    marginLeft + (i * (additionalImagesWidth + 5)),
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
                pdf.text(`* Há mais ${activity.additionalImages.length - maxAdditionalImages} imagens disponíveis no sistema`, marginLeft, currentY);
              }
              
              currentY += 80;
            }
          }
        } catch (imgError) {
          console.error('Erro ao adicionar imagem principal:', imgError);
          
          // Apenas descrição se houver erro na imagem
          pdf.setFont('helvetica', 'bold');
          pdf.text('Descrição:', marginLeft, startY);
          pdf.setFont('helvetica', 'normal');
          
          const splitText = pdf.splitTextToSize(activity.description, contentWidth);
          pdf.text(splitText, marginLeft, startY + 8);
          
          let currentY = startY + 8 + (splitText.length * 5) + 10;
          pdf.text('* Não foi possível carregar a imagem do pedido', marginLeft, currentY);
          currentY += 10;
        }
      } else {
        // Sem imagem, apenas descrição
        pdf.setFont('helvetica', 'bold');
        pdf.text('Descrição:', marginLeft, startY);
        pdf.setFont('helvetica', 'normal');
        
        const splitText = pdf.splitTextToSize(activity.description, contentWidth);
        pdf.text(splitText, marginLeft, startY + 8);
        
        startY = startY + 8 + (splitText.length * 5) + 15;
      }
      
      // Informações adicionais
      let infoY = Math.min(pageHeight - 50, startY + 110); // Garantir que não ultrapasse a página
      
      // Remoção da informação de quantidade conforme solicitado
      
      // Informações de retorno, se o pedido foi retornado
      if ((activity as any).wasReturned) {
        infoY += 10;
        pdf.setFillColor(255, 240, 240); // Fundo levemente vermelho
        pdf.rect(marginLeft, infoY - 5, contentWidth, 25, 'F');
        
        pdf.setTextColor(180, 0, 0); // Texto vermelho
        pdf.setFontSize(11);
        pdf.text('PEDIDO RETORNADO', marginLeft + 5, infoY);
        pdf.text(`Retornado por: ${(activity as any).returnedBy || 'Não informado'}`, marginLeft + 5, infoY + 8);
        
        if ((activity as any).returnNotes) {
          pdf.text(`Motivo: ${(activity as any).returnNotes}`, marginLeft + 5, infoY + 16);
        }
        
        pdf.setTextColor(0, 0, 0); // Restaurar cor do texto
      }
      
      // Adicionar rodapé
      pdf.setFontSize(8);
      pdf.setTextColor(100, 100, 100);
      const today = new Date().toLocaleDateString('pt-BR');
      pdf.text(`Gerado em ${today} | Stamp Blue 2025 | Desenvolvido por Iuri`, pageWidth / 2, pageHeight - 5, { align: 'center' });
      
      // Salvar o PDF
      pdf.save(`${activity.title || 'pedido'}.pdf`);
      
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      alert('Ocorreu um erro ao gerar o PDF. Tente novamente ou entre em contato com o suporte.');
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