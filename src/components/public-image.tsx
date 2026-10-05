"use client";

import Image from "next/image";
import { useState, type ReactNode } from "react";

export function PublicImage({ src, alt, className, fallback = null }: { src: string | null; alt: string; className: string; fallback?: ReactNode }) {
  const [failed, setFailed] = useState<string | null>(null);
  if (!src || failed === src) return fallback;
  return <Image unoptimized src={src} alt={alt} width={800} height={500} className={className} onError={() => setFailed(src)} />;
}
