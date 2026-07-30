"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

export function AfipQrCode({ url, size = 140 }: { url: string; size?: number }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(url, { width: size, margin: 1 })
      .then((result) => {
        if (!cancelled) setDataUrl(result);
      })
      .catch(() => {
        if (!cancelled) setDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [url, size]);

  if (!dataUrl) {
    return <div className="animate-pulse rounded-xl bg-slate-100" style={{ width: size, height: size }} />;
  }

  // eslint-disable-next-line @next/next/no-img-element -- data: URL generado en cliente, no aplica next/image.
  return <img alt="Código QR fiscal AFIP/ARCA" height={size} src={dataUrl} width={size} />;
}
