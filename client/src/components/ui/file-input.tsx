import { useState, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FileInputProps {
  className?: string;
  value?: File | null;
  onChange: (file: File | File[] | null) => void;
  accept?: string;
  maxSize?: number;
  placeholder?: string;
  error?: string;
  multiple?: boolean;
}

export function FileInput({
  className,
  value,
  onChange,
  accept,
  maxSize,
  placeholder = "Selecionar arquivo...",
  error,
  multiple = false
}: FileInputProps) {
  const [dragActive, setDragActive] = useState(false);
  const [localError, setLocalError] = useState<string | undefined>(error);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    if (maxSize && file.size > maxSize) {
      setLocalError(`O arquivo excede o tamanho máximo de ${(maxSize / (1024 * 1024)).toFixed(1)}MB`);
      return;
    }
    
    setLocalError(undefined);
    onChange(file);
  };

  const handleFiles = (files: FileList) => {
    if (!files.length) return;
    
    // Verificar tamanho de cada arquivo
    const oversizedFiles = Array.from(files).filter(file => maxSize && file.size > maxSize);
    if (oversizedFiles.length > 0) {
      setLocalError(`Um ou mais arquivos excedem o tamanho máximo de ${(maxSize! / (1024 * 1024)).toFixed(1)}MB`);
      return;
    }
    
    setLocalError(undefined);
    
    if (multiple) {
      // Modo múltiplo: retorna array de arquivos
      onChange(Array.from(files));
    } else {
      // Modo único: retorna apenas o primeiro arquivo
      onChange(files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
  };

  const handleDrag = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleRemove = () => {
    onChange(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      <div
        className={cn(
          "border-2 border-dashed rounded-md p-4 text-center cursor-pointer relative",
          {
            "border-primary bg-primary/5": dragActive,
            "border-destructive": localError,
            "border-input hover:border-primary/50": !dragActive && !localError,
          },
          className
        )}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <Input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={handleChange}
          accept={accept}
          multiple={multiple}
        />
        
        {value ? (
          <div className="py-2">
            <p className="text-sm font-medium">{value.name}</p>
            <p className="text-xs text-muted-foreground">
              {(value.size / 1024).toFixed(1)} KB
            </p>
          </div>
        ) : (
          <div className="py-8 px-4">
            <p className="text-sm text-muted-foreground mb-1">
              {placeholder}
            </p>
            <p className="text-xs text-muted-foreground">
              {multiple ? 'Arraste e solte ou clique para selecionar múltiplos arquivos' : 'Arraste e solte ou clique para selecionar'}
            </p>
          </div>
        )}
      </div>
      
      {localError && (
        <p className="text-sm text-destructive">{localError}</p>
      )}
      
      {value && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            handleRemove();
          }}
        >
          Remover arquivo
        </Button>
      )}
    </div>
  );
}