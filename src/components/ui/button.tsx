import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva("inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:pointer-events-none disabled:opacity-50", { variants: { variant: { default: "bg-slate-900 text-white hover:bg-slate-700", outline: "border border-slate-300 bg-white hover:bg-slate-100" } }, defaultVariants: { variant: "default" } });
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}
export function Button({ className, variant, ...props }: ButtonProps) { return <button className={cn(buttonVariants({ variant }), className)} {...props} />; }
