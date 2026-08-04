"use client";

// Shim de iconos: reemplaza a lucide-react con el mismo nombre/API, pero
// renderizando iconos del set Solar (Iconify) bundleados local (offline).
// En cada pantalla se cambia solo el import: "lucide-react" -> "@/components/icons".
//
// Concepto -> variante "bold" (glifo estilo iOS). Direccionales/chevrons -> "linear".
// Se mantienen de lucide los universales donde Solar no aporta (+, −, ✓, ✕, spinner).
import "@/lib/icons";

import { Icon } from "@iconify/react";
import type { ComponentProps, ComponentType } from "react";

// Los que siguen viniendo de lucide (glifos neutros dentro de botones/badges).
export { Check, Loader2, Minus, Plus, X } from "lucide-react";

type IconifyProps = ComponentProps<typeof Icon>;
export type IconProps = Omit<IconifyProps, "icon" | "width" | "height"> & { size?: number | string };
export type LucideIcon = ComponentType<IconProps>;

function solar(name: string): LucideIcon {
  const Cmp = ({ size, ...props }: IconProps) => (
    <Icon icon={name} {...(size != null ? { width: size, height: size } : {})} {...props} />
  );
  Cmp.displayName = name;
  return Cmp;
}

export const ArrowLeft = solar("solar:arrow-left-linear");
export const ArrowRight = solar("solar:arrow-right-linear");
export const ArrowUpRight = solar("solar:arrow-right-up-linear");
export const ArrowLeftRight = solar("solar:transfer-horizontal-bold");
export const Ban = solar("solar:forbidden-circle-bold");
export const Banknote = solar("solar:banknote-2-bold");
export const Calendar = solar("solar:calendar-bold");
export const CalendarDays = solar("solar:calendar-bold");
export const Camera = solar("solar:camera-bold");
export const CheckCircle2 = solar("solar:check-circle-bold");
export const ChevronDown = solar("solar:alt-arrow-down-linear");
export const ChevronLeft = solar("solar:alt-arrow-left-linear");
export const ChevronRight = solar("solar:alt-arrow-right-linear");
export const CircleSlash = solar("solar:forbidden-circle-bold");
export const Copy = solar("solar:copy-bold");
export const CreditCard = solar("solar:card-bold");
export const Eye = solar("solar:eye-bold");
export const EyeOff = solar("solar:eye-closed-bold");
export const ImageIcon = solar("solar:gallery-bold");
export const HomeIcon = solar("solar:home-2-bold");
export const KeyRound = solar("solar:key-bold");
export const Landmark = solar("solar:safe-2-bold");
export const Link2 = solar("solar:link-bold");
export const Lock = solar("solar:lock-bold");
export const LogOut = solar("solar:logout-2-bold");
export const Mail = solar("solar:letter-bold");
export const MapPin = solar("solar:map-point-bold");
export const Monitor = solar("solar:monitor-bold");
export const MoreHorizontal = solar("solar:menu-dots-bold");
export const Pencil = solar("solar:pen-bold");
export const PiggyBank = solar("solar:money-bag-bold");
export const Flashlight = solar("solar:flashlight-bold");
export const QrCode = solar("solar:qr-code-bold");
export const ReceiptText = solar("solar:bill-list-bold");
export const RotateCcw = solar("solar:refresh-bold");
export const Scissors = solar("solar:scissors-bold");
export const Search = solar("solar:magnifer-linear");
export const ShieldCheck = solar("solar:shield-check-bold");
export const ShoppingBag = solar("solar:bag-4-bold");
export const SlidersHorizontal = solar("solar:tuning-2-bold");
export const Smartphone = solar("solar:smartphone-bold");
export const Split = solar("solar:card-transfer-bold");
export const Sparkles = solar("solar:magic-stick-3-bold");
export const Store = solar("solar:shop-2-bold");
export const Tag = solar("solar:tag-bold");
export const Ticket = solar("solar:ticket-bold");
export const Trash2 = solar("solar:trash-bin-trash-bold");
export const TrendingDown = solar("solar:graph-down-bold");
export const TrendingUp = solar("solar:graph-up-bold");
export const TriangleAlert = solar("solar:danger-triangle-bold");
export const Users = solar("solar:users-group-rounded-bold");
export const Wallet = solar("solar:wallet-bold");

// Icono resuelto en runtime: el nombre llega como dato (el rubro del negocio o un
// módulo), no como import. Reemplaza al `Scissors` fijo en las pantallas que
// tienen que hablar el idioma de cada rubro.
export function DynamicIcon({ name, size, ...props }: IconProps & { name: string }) {
  return <Icon icon={name} {...(size != null ? { width: size, height: size } : {})} {...props} />;
}

// Iconos genéricos de reemplazo, para lo que antes era específico de barbería.
export const Package = solar("solar:box-bold");
