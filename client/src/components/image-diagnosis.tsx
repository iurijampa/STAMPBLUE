import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ImageDiagnosisProps {
  imageData: string | null;
  activityId: number;
  title?: string;
}

export default function ImageDiagnosis({ imageData, activityId, title = "Diagnóstico de Imagem" }: ImageDiagnosisProps) {
  const [imageType, setImageType] = useState<string>('desconhecido');
  const [imageSize, setImageSize] = useState<string>('desconhecido');
  const [imageInfo, setImageInfo] = useState<{[key: string]: any}>({});
  const [showFullData, setShowFullData] = useState(false);
  
  useEffect(() => {
    if (imageData) {
      // Determine o tipo de imagem
      if (imageData.startsWith('data:image/')) {
        setImageType('base64');
        
        // Calcula o tamanho aproximado
        const dataSize = imageData.length - (imageData.indexOf(',') + 1);
        const sizeInKB = Math.round(dataSize * 3 / 4 / 1024);
        setImageSize(`~${sizeInKB} KB`);
        
        // Analisar o tipo de imagem de forma mais detalhada
        const mimeMatch = imageData.match(/^data:([^;]+);base64,/);
        const mime = mimeMatch ? mimeMatch[1] : 'desconhecido';
        
        setImageInfo({
          mime,
          encoding: 'base64',
          dataSize,
          prefixLength: imageData.indexOf(',') + 1,
          firstChars: imageData.substring(imageData.indexOf(',') + 1, imageData.indexOf(',') + 21) + '...',
        });
      } else if (imageData.startsWith('/')) {
        setImageType('arquivo');
        setImageSize('desconhecido (caminho de arquivo)');
        setImageInfo({
          path: imageData
        });
      } else {
        setImageType('url');
        setImageSize('desconhecido (URL externa)');
        setImageInfo({
          url: imageData
        });
      }
    } else {
      setImageType('nulo');
      setImageSize('0 bytes');
      setImageInfo({});
    }
  }, [imageData]);
  
  // Renderização especial para dados base64
  const renderBase64Preview = () => {
    if (!imageData || !imageData.startsWith('data:')) return null;
    
    const sample = imageData.substring(0, Math.min(100, imageData.length));
    
    return (
      <div className="mt-2 space-y-2">
        <Label>Início dos dados base64:</Label>
        <div className="bg-muted p-2 rounded text-xs font-mono break-all">
          {sample}...
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => setShowFullData(!showFullData)}
        >
          {showFullData ? "Esconder dados completos" : "Mostrar dados completos"}
        </Button>
        
        {showFullData && (
          <ScrollArea className="h-32 w-full rounded-md border mt-2">
            <div className="bg-muted p-2 rounded text-xs font-mono break-all">
              {imageData}
            </div>
          </ScrollArea>
        )}
      </div>
    );
  };
  
  const renderImagePreview = () => {
    if (!imageData) return null;
    
    return (
      <div className="mt-4 border rounded-md p-2 bg-muted/30">
        <div className="text-xs text-muted-foreground mb-2">Pré-visualização da imagem:</div>
        <div className="flex items-center justify-center h-40 bg-white rounded-md">
          <img 
            src={imageData} 
            alt={`Pedido #${activityId}`}
            className="max-h-full max-w-full object-contain"
            onError={(e) => {
              console.error("Erro ao carregar imagem no diagnóstico:", e);
              e.currentTarget.onerror = null;
              e.currentTarget.src = "/no-image.svg";
            }}
          />
        </div>
        <div className="text-xs text-muted-foreground mt-2 text-center">
          {imageType === 'base64' 
            ? "Exibindo imagem a partir de dados base64" 
            : imageType === 'arquivo' 
              ? "Exibindo imagem a partir do caminho de arquivo" 
              : "Exibindo imagem a partir de URL"}
        </div>
      </div>
    );
  };
  
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="text-base">{title}</CardTitle>
          <Badge variant={imageType === 'base64' ? 'default' : 'outline'}>
            {imageType}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-muted-foreground text-xs">ID da Atividade</Label>
            <p className="font-medium">#{activityId}</p>
          </div>
          <div>
            <Label className="text-muted-foreground text-xs">Tamanho</Label>
            <p className="font-medium">{imageSize}</p>
          </div>
        </div>
        
        <div>
          <Label className="text-muted-foreground text-xs">Tipo de Dados</Label>
          <p className="font-medium">{imageType === 'base64' 
            ? `Dados codificados em base64 (${imageInfo.mime || 'mime desconhecido'})` 
            : imageType === 'arquivo' 
              ? `Caminho para arquivo: ${imageInfo.path}` 
              : imageType === 'url' 
                ? `URL externa: ${imageInfo.url}` 
                : 'Dados não disponíveis'}</p>
        </div>
        
        {imageType === 'base64' && renderBase64Preview()}
        {renderImagePreview()}
      </CardContent>
    </Card>
  );
}