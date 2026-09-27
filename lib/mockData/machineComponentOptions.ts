export interface MachineComponentOption {
  value: string;
  group: string;
  label: string;
}

export const machineComponentOptions: MachineComponentOption[] = [
  { value: "hydraulics-main-pump", group: "Hydraulics", label: "Main pump" },
  { value: "hydraulics-boom-cylinder", group: "Hydraulics", label: "Boom cylinder" },
  { value: "hydraulics-hose-manifold", group: "Hydraulics", label: "Hose manifold" },
  { value: "engine-c175-16", group: "Engine", label: "C175-16" },
  { value: "engine-turbocharger", group: "Engine", label: "Turbocharger" },
  { value: "engine-fuel-injector", group: "Engine", label: "Fuel injector" },
  { value: "powertrain-torque-converter", group: "Powertrain", label: "Torque converter" },
  { value: "powertrain-transmission", group: "Powertrain", label: "Transmission — 6F/1R" },
  { value: "powertrain-final-drive-left", group: "Powertrain", label: "Final drive — left" },
  { value: "powertrain-final-drive-right", group: "Powertrain", label: "Final drive — right" },
  { value: "brakes-service-brake", group: "Brakes", label: "Service brake" },
  { value: "brakes-park-brake", group: "Brakes", label: "Park brake" },
  { value: "electrical-alternator", group: "Electrical", label: "Alternator" },
  { value: "electrical-wiring-harness", group: "Electrical", label: "Wiring harness" },
  { value: "chassis-frame", group: "Chassis", label: "Frame" },
  { value: "chassis-undercarriage", group: "Chassis", label: "Undercarriage" },
  { value: "operator-cab-seat", group: "Operator cab", label: "Seat & controls" },
];
