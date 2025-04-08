import * as React from "react";
import { cn } from "@/lib/utils";
import { Upload, X } from "lucide-react";
import { Button } from "./button";

interface FileInputProps {
  className?: string;
  value?: File | null;
  onChange: (file: File | null) => void;
  accept?: string;
  maxSize?: number;
  placeholder?: string;
  error?: string;
}

export function FileInput({
  className,
  value,
  onChange,
  accept = "image/*",
  maxSize = 5 * 1024 * 1024, // 5MB default
  placeholder = "Arraste e solte uma imagem ou clique para selecionar",
  error,
}: FileInputProps) {
  const [preview, setPreview] = React.useState<string | null>(null);
  const [dragActive, setDragActive] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Generate preview when file changes
  React.useEffect(() => {
    if (!value) {
      setPreview(null);
      return;
    }

    const objectUrl = URL.createObjectURL(value);
    setPreview(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [value]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      handleFile(file);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      handleFile(file);
    }
  };

  const handleFile = (file: File) => {
    if (file.size > maxSize) {
      alert(`Arquivo muito grande. Tamanho máximo: ${maxSize / 1024 / 1024}MB`);
      return;
    }
    
    onChange(file);
  };

  const handleButtonClick = () => {
    inputRef.current?.click();
  };

  const handleRemove = () => {
    onChange(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  return (
    <div className={cn("relative", className)}>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleChange}
        className="sr-only"
        aria-hidden="true"
      />
      
      <div
        className={cn(
          "flex flex-col items-center justify-center border-2 border-dashed rounded-md p-4 transition-colors",
          "min-h-[150px] cursor-pointer",
          dragActive 
            ? "border-primary-500 bg-primary-50" 
            : "border-neutral-300 bg-neutral-50 hover:bg-neutral-100",
          error && "border-red-400",
          preview && "border-solid"
        )}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={handleButtonClick}
      >
        {preview ? (
          <div className="relative w-full h-full flex items-center justify-center">
            <img
              src={preview}
              alt="Preview"
              className="max-h-[200px] max-w-full object-contain rounded"
            />
            <Button
              variant="destructive"
              size="icon"
              className="absolute top-2 right-2 h-6 w-6"
              onClick={(e) => {
                e.stopPropagation();
                handleRemove();
              }}
              type="button"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <>
            <Upload className="h-10 w-10 text-neutral-400 mb-2" />
            <p className="text-sm text-neutral-500 text-center">{placeholder}</p>
            <p className="text-xs text-neutral-400 mt-1">
              PNG, JPG ou GIF (max. {maxSize / 1024 / 1024}MB)
            </p>
          </>
        )}
      </div>
      
      {error && (
        <p className="text-red-500 text-sm mt-1">{error}</p>
      )}
    </div>
  );
}
