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

  return (
    <div className={cn("flex items-center", className)}>
      <svg
        viewBox="0 0 500 200"
        className={cn(sizeClasses[size], "w-auto")}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Curva/Semicírculo */}
        <path
          d="M95 135C95 80 140 50 220 50C300 50 380 80 405 150"
          stroke="currentColor"
          strokeWidth="25"
          fill="none"
        />
        
        {/* STAMP */}
        <path
          d="M170 80H245C250 80 255 85 255 90C255 95 250 100 245 100H230V130C230 135 225 140 220 140C215 140 210 135 210 130V100H170C165 100 160 95 160 90C160 85 165 80 170 80Z"
          fill="currentColor"
        />
        <path
          d="M260 80H265C275 80 285 90 285 100V120C285 130 275 140 265 140H260C250 140 240 130 240 120V100C240 90 250 80 260 80ZM260 100V120H265V100H260Z"
          fill="currentColor"
        />
        <path
          d="M295 80H340C345 80 350 85 350 90C350 95 345 100 340 100H315V100C315 105 315 105 320 105H340C345 105 350 110 350 115V130C350 135 345 140 340 140H295C290 140 285 135 285 130C285 125 290 120 295 120H320V120C320 115 320 115 315 115H295C290 115 285 110 285 105V90C285 85 290 80 295 80Z"
          fill="currentColor"
        />
        <path
          d="M355 90C355 85 360 80 365 80H400C405 80 410 85 410 90V140H390V100H375V140H355V90Z"
          fill="currentColor"
        />
        <path
          d="M415 90C415 85 420 80 425 80H460C465 80 470 85 470 90V100C470 105 465 110 460 110H435V120H460C465 120 470 125 470 130C470 135 465 140 460 140H425C420 140 415 135 415 130V90ZM435 100H450V90H435V100Z"
          fill="currentColor"
        />
        
        {/* BLUE */}
        <path
          d="M230 145H245C250 145 255 150 255 155V175C255 180 250 185 245 185H230C225 185 220 180 220 175V155C220 150 225 145 230 145ZM230 165H245V155H230V165Z"
          fill="currentColor"
        />
        <path
          d="M265 145H280C285 145 290 150 290 155V175C290 180 285 185 280 185H265C260 185 255 180 255 175V155C255 150 260 145 265 145ZM265 165H280V155H265V165Z"
          fill="currentColor"
        />
        <path
          d="M300 155C300 150 305 145 310 145H335C340 145 345 150 345 155V175C345 180 340 185 335 185H310C305 185 300 180 300 175V155ZM320 165H325V155H320V165Z"
          fill="currentColor"
        />
        <path
          d="M350 145H385C390 145 395 150 395 155C395 160 390 165 385 165H370V175C370 180 365 185 360 185C355 185 350 180 350 175V145Z"
          fill="currentColor"
        />
        
        {/* Marca Registrada */}
        <circle
          cx="400"
          cy="60"
          r="10"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
        />
        <path
          d="M396 60L400 56L404 60L400 64L396 60Z"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
        />
      </svg>
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