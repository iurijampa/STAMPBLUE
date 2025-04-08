import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  withText?: boolean;
}

export function Logo({ className, size = 'md', withText = true }: LogoProps) {
  const sizeClasses = {
    sm: 'h-8',
    md: 'h-10',
    lg: 'h-12'
  };

  return (
    <div className={cn("flex items-center", className)}>
      <svg 
        width="40" 
        height="40" 
        viewBox="0 0 40 40" 
        className={cn(sizeClasses[size])}
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
      >
        <path 
          d="M20 5L35 12.5V27.5L20 35L5 27.5V12.5L20 5Z" 
          fill="url(#paint0_linear)" 
          stroke="currentColor" 
          strokeWidth="2"
        />
        <path 
          d="M15 17.5H25M15 22.5H25" 
          stroke="white" 
          strokeWidth="2" 
          strokeLinecap="round"
        />
        <defs>
          <linearGradient 
            id="paint0_linear" 
            x1="5" 
            y1="5" 
            x2="35" 
            y2="35" 
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="hsl(var(--primary))" />
            <stop offset="1" stopColor="hsl(var(--primary))" stopOpacity="0.7" />
          </linearGradient>
        </defs>
      </svg>
      
      {withText && (
        <span className="ml-2 font-bold text-lg">T-Shirts Flow</span>
      )}
    </div>
  );
}

export function FooterCredits() {
  return (
    <div className="text-center py-4 text-sm text-neutral-500">
      <p className="italic">Desenvolvido por Iuri</p>
    </div>
  );
}