/** Ícones SVG do protótipo. */
import type { ReactNode } from "react";

const Svg = ({ children, className, w = 2 }: { children: ReactNode; className?: string; w?: number }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);

export const IcPainel = () => (
  <Svg className="ic">
    <rect x="3" y="3" width="7" height="9" />
    <rect x="14" y="3" width="7" height="5" />
    <rect x="14" y="12" width="7" height="9" />
    <rect x="3" y="16" width="7" height="5" />
  </Svg>
);
export const IcColab = () => (
  <Svg className="ic">
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2 20c0-4 3-6 7-6s7 2 7 6" />
    <path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14c2.5.7 4 2.5 4 6" />
  </Svg>
);
export const IcCursos = () => (
  <Svg className="ic">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z" />
    <path d="M4 19.5V21h16" />
  </Svg>
);
export const IcEmbarques = () => (
  <Svg className="ic">
    <circle cx="12" cy="5" r="2.5" />
    <path d="M12 7.5V22M8 11h8M5 14H2a10 10 0 0 0 20 0h-3" />
  </Svg>
);
export const IcLista = () => (
  <Svg className="ic">
    <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
  </Svg>
);
export const IcBarco = () => (
  <Svg className="ic">
    <path d="M3 15h18l-2.5 5h-13z" />
    <path d="M6 15v-5h9l3 5" />
    <path d="M10 10V6h3" />
  </Svg>
);
export const IcSeta = () => (
  <Svg w={2.5}>
    <path d="M15 6l-6 6 6 6" />
  </Svg>
);
export const IcChat = () => (
  <Svg>
    <path d="M21 12a8 8 0 0 1-11.6 7.1L3 21l1.9-5.4A8 8 0 1 1 21 12z" />
  </Svg>
);
export const IcSino = () => (
  <Svg>
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </Svg>
);
export const IcClipe = () => (
  <Svg>
    <path d="M21.4 11.1l-8.5 8.5a5.5 5.5 0 0 1-7.8-7.8l8.5-8.5a3.7 3.7 0 0 1 5.2 5.2l-8.5 8.5a1.8 1.8 0 0 1-2.6-2.6l7.8-7.8" />
  </Svg>
);
export const IcPessoa = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </svg>
);
export const IcDados = () => (
  <Svg>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </Svg>
);
export const IcLivro = () => (
  <Svg>
    <path d="M4 19.5V5a2 2 0 0 1 2-2h14v16H6.5a2.5 2.5 0 0 0 0 5H20" />
  </Svg>
);
export const IcAncora = () => (
  <Svg>
    <circle cx="12" cy="5" r="2" />
    <path d="M12 7v14M5 12H3a9 9 0 0 0 18 0h-2M8 10h8" />
  </Svg>
);
export const IcVacina = () => (
  <Svg>
    <path d="M18 2l4 4M17 7l3-3M19 9 8.7 19.3a2.4 2.4 0 0 1-3.4 0l-.6-.6a2.4 2.4 0 0 1 0-3.4L15 5M9 11l4 4M5 19l-3 3M14 4l6 6" />
  </Svg>
);
export const IcFechar = () => (
  <Svg>
    <path d="M18 6 6 18M6 6l12 12" />
  </Svg>
);
export const IcOk = () => (
  <Svg>
    <path d="M20 6 9 17l-5-5" />
  </Svg>
);
