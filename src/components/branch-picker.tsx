"use client";

// Selector de sucursal del stock con Syncfusion EJ2 DropDownList: elegir una
// sucursal navega directo (el filtro de antes pedía un botón "Ver" aparte).
import { useRouter } from "next/navigation";

import { DropDownListComponent } from "@syncfusion/ej2-react-dropdowns";

type BranchOption = { id: string; name: string };

export function BranchPicker({ branches, current }: { branches: BranchOption[]; current: string }) {
  const router = useRouter();

  return (
    <DropDownListComponent
      change={(args) => {
        const next = String(args.value ?? "");
        if (next && next !== current) router.push(`/stock?branchId=${next}`);
      }}
      dataSource={branches}
      fields={{ text: "name", value: "id" }}
      placeholder="Sucursal"
      value={current}
      width="100%"
    />
  );
}
