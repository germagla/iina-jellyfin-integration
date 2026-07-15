import { useEffect, useState } from 'react';
import type { CatalogBridge } from '../bridge/contracts';

const MAX_DATA_URL_LENGTH = 5 * 1024 * 1024;
const SAFE_DATA_IMAGE = /^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=]+$/i;
const SAFE_RELATIVE_IMAGE = /^(?:(?:\.\.\/){2})?demo\/[a-z0-9][a-z0-9_-]*\.(?:png|jpe?g|webp)$/i;

export function safeArtworkSource(source: string | undefined): string | undefined {
  if (!source || source.length > MAX_DATA_URL_LENGTH) return undefined;
  if (SAFE_DATA_IMAGE.test(source) || SAFE_RELATIVE_IMAGE.test(source)) return source;
  return undefined;
}

interface ArtworkProps {
  source?: string;
  alt: string;
  className?: string;
}

export function Artwork({ source, alt, className = '' }: ArtworkProps) {
  const [failedSource, setFailedSource] = useState<string>();
  const safeSource = safeArtworkSource(source);
  const failed = safeSource !== undefined && safeSource === failedSource;

  if (!safeSource || failed) {
    return <span className={`artwork-fallback ${className}`} aria-hidden="true" />;
  }

  return (
    <img
      className={className}
      src={safeSource}
      alt={alt}
      draggable="false"
      onError={() => setFailedSource(safeSource)}
    />
  );
}

interface BrokeredArtworkProps extends ArtworkProps {
  bridge: CatalogBridge;
  itemId: string;
  imageType: 'Primary' | 'Backdrop' | 'Thumb';
  imageTag?: string;
  width: number;
  height: number;
}

export function BrokeredArtwork({
  bridge,
  itemId,
  imageType,
  imageTag,
  width,
  height,
  source,
  alt,
  className,
}: BrokeredArtworkProps) {
  const [brokeredSource, setBrokeredSource] = useState<string>();

  useEffect(() => {
    if (safeArtworkSource(source)) return;
    let active = true;
    void bridge
      .request('artwork.fetch', {
        itemId,
        imageType,
        imageTag,
        width,
        height,
        quality: 85,
      })
      .then((result) => {
        if (active && safeArtworkSource(result.dataUrl)) setBrokeredSource(result.dataUrl);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [bridge, height, imageTag, imageType, itemId, source, width]);

  return (
    <Artwork
      source={safeArtworkSource(source) ? source : brokeredSource}
      alt={alt}
      className={className}
    />
  );
}
