import Image from "next/image";

export function BrandedQrCode({ src, alt, priority = false }: { src: string; alt: string; priority?: boolean }) {
  return <div className="branded-qr-code">
    <Image className="branded-qr-code-image" unoptimized width={720} height={720} src={src} alt={alt} priority={priority} />
    <Image className="branded-qr-code-logo" unoptimized width={512} height={512} src="/icon.svg" alt="" aria-hidden="true" />
  </div>;
}
