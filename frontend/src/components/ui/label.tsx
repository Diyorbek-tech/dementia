import * as React from "react"
import { cn } from "@/lib/utils"

const Label = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => (
    <label
      ref={ref}
      className={cn("text-lg font-semibold leading-tight peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-slate-800 mb-2 block", className)}
      {...props}
    />
  )
)
Label.displayName = "Label"

export { Label }
