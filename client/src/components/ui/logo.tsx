import React from "react";
import { cn } from "@/lib/utils";

interface LogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

export function Logo({ size = "md", className }: LogoProps) {
  const sizeClasses = {
    sm: "h-6",
    md: "h-8",
    lg: "h-10",
    xl: "h-12",
  };

  // Usando o logo principal da Stamp Blue
  return (
    <div className={cn("flex items-center", className)}>
      <div 
        className={cn(
          sizeClasses[size], 
          "bg-[#0047FF] flex items-center justify-center rounded-md h-10 px-2"
        )}
      >
        <span className="text-white font-bold">STAMP BLUE</span>
      </div>
    </div>
  );
}

export function FooterCredits() {
  return (
    <div className="text-center text-neutral-500 text-xs py-2 mt-auto">
      <em>Desenvolvido por Iuri</em>
    </div>
  );
}