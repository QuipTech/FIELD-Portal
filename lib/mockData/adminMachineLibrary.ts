export interface MachineModel {
  id: string;
  name: string;
  category: string;
  systemsCount: number;
  assetsCount: number;
}

export const machineModels: MachineModel[] = [
  { id: "cat-793f", name: "CAT 793F", category: "haul truck", systemsCount: 6, assetsCount: 42 },
  { id: "komatsu-wa900", name: "Komatsu WA900", category: "wheel loader", systemsCount: 8, assetsCount: 11 },
  { id: "sandvik-dr410", name: "Sandvik DR410", category: "rotary drill", systemsCount: 5, assetsCount: 6 },
  { id: "hitachi-ex3600", name: "Hitachi EX3600", category: "excavator", systemsCount: 7, assetsCount: 4 },
];

export interface MachineSystemBranch {
  name: string;
  componentCount: number;
  components?: string[];
}

export const cat793fSystemTree: MachineSystemBranch[] = [
  {
    name: "Powertrain",
    componentCount: 14,
    components: ["Engine — C175-16", "Torque converter", "Transmission — 6F/1R"],
  },
  { name: "Hydraulics", componentCount: 12 },
  { name: "Brakes", componentCount: 9 },
  { name: "Electrical", componentCount: 9 },
  { name: "Chassis", componentCount: 7 },
];
