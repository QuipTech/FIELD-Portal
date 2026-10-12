// A machine's equipment tree: systems (Powertrain, Hydraulics …) and the
// components installed in each.
export interface MachineSystem {
  id: string;
  name: string;
}

export type ComponentCondition = "ok" | "worn" | "service_due" | "fault";

export interface MachineComponent {
  id: string;
  systemId: string;
  systemName: string;
  name: string;
  // From the component's latest history entry; null when nothing about
  // its condition has been recorded.
  condition: ComponentCondition | null;
  // e.g. "Serviced 19 Feb", "Fault logged 28 Feb" or "S/N 4T-9455".
  caption: string;
}
