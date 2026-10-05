import Link from "next/link";
import { savePublicBranding } from "@/app/actions/public-branding";
import { PublicImageUpload } from "@/components/public-image-upload";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function PublicSiteSettings({ shop }: { shop: { slug: string; logoUrl: string | null; coverImageUrl: string | null; publicDescription: string | null; instagramUrl: string | null } }) {
  return <Card className="max-w-3xl">
    <CardHeader className="flex flex-wrap items-center justify-between gap-3"><CardTitle>Sitio público</CardTitle><Button nativeButton={false} variant="outline" size="sm" render={<Link href={`/book/${shop.slug}`} target="_blank" rel="noopener noreferrer" />}>Ver sitio público</Button></CardHeader>
    <CardContent className="space-y-6">
      <div className="grid gap-5 sm:grid-cols-2"><PublicImageUpload target="logo" initialUrl={shop.logoUrl} label="Logo" /><PublicImageUpload target="cover" initialUrl={shop.coverImageUrl} label="Portada" /></div>
      <form action={savePublicBranding} className="space-y-4">
        <div className="grid gap-2"><Label htmlFor="public-description">Descripción pública</Label><Textarea id="public-description" name="description" maxLength={600} rows={3} defaultValue={shop.publicDescription || ""} /></div>
        <div className="grid gap-2"><Label htmlFor="public-instagram">Instagram</Label><Input id="public-instagram" name="instagram" type="url" maxLength={300} placeholder="https://www.instagram.com/tu-barberia" defaultValue={shop.instagramUrl || ""} /></div>
        <Button type="submit">Guardar sitio público</Button>
      </form>
    </CardContent>
  </Card>;
}
