import type { Machine } from "@/lib/types/machine";

export const machines: Machine[] = [
  { id: "HT-2188", model: "CAT 793F", site: "Pit 2", status: "running", hours: 18402 },
  { id: "HT-2201", model: "CAT 793F", site: "Pit 4", status: "down", hours: 14208 },
  { id: "LD-0904", model: "Komatsu WA900", site: "Pit 4", status: "serviceDue", hours: 9771 },
  { id: "DR-4412", model: "Sandvik DR410", site: "Bench 7", status: "running", hours: 6015 },
  { id: "EX-7730", model: "Hitachi EX3600", site: "Pit 1", status: "running", hours: 21988 },
  { id: "WT-0355", model: "CAT 777G", site: "Pit 2", status: "running", hours: 12640 },
];

export const findMachine = (id: string): Machine | undefined => {
  return machines.find((machine) => machine.id === id);
};
