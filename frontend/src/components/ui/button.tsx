import * as React from "react"
import { cn } from "@/lib/utils"

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost"
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-lg font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
          variant === "default" && "bg-blue-600 text-white hover:bg-blue-700 h-14 px-8 py-3",
          variant === "outline" && "bg-transparent border-2 border-slate-300 text-slate-900 hover:bg-slate-50 h-14 px-8 py-3",
          variant === "ghost" && "bg-transparent text-slate-900 hover:bg-slate-100 h-14 px-8 py-3",
          className
        )}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button }
