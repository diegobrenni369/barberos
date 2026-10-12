import Image from "next/image";
import { cn } from "@/lib/utils";

export function BrandLogo({ symbol = false, sidebar = false, className }: { symbol?: boolean; sidebar?: boolean; className?: string }) {
  const asset = symbol ? "symbol" : "logo";
  return <span className={cn("inline-block shrink-0", className)} style={sidebar && !symbol ? { height: 36 } : undefined}>
    <Image src={`/branding/tevno-${asset}-black.svg?v=2`} alt="Tevno" width={symbol ? 100 : 640} height={symbol ? 100 : 180} style={sidebar && !symbol ? { height: 48, width: "auto" } : undefined} className={cn("object-contain dark:hidden", symbol ? "size-8" : "h-9 w-auto")} />
    <Image src={`/branding/tevno-${asset}-white.svg?v=2`} alt="Tevno" width={symbol ? 100 : 640} height={symbol ? 100 : 180} style={sidebar && !symbol ? { height: 48, width: "auto" } : undefined} className={cn("hidden object-contain dark:block", symbol ? "size-8" : "h-9 w-auto")} />
  </span>;
}
