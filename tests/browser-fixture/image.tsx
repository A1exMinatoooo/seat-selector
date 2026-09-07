import type { ImageProps } from "next/image";
export default function Image({ src, alt, width, height }: ImageProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={typeof src === "string" ? src : ""}
      alt={alt}
      width={Number(width)}
      height={Number(height)}
    />
  );
}
