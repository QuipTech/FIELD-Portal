import {
  HistoryEntryRow,
  MachineRow,
} from '../machineHistory/types/machineHistoryRows';
import { toIsoDay } from '../common/utils/toIsoDay';

const HISTORY_ENTRY_MAX_CHARS = 400;

const describeMachine = (machine: MachineRow): string => {
  const details = [
    machine.site ? `site ${machine.site}` : null,
    machine.operating_hours !== null
      ? `${machine.operating_hours} operating hours`
      : null,
    `status ${machine.status}`,
  ].filter(Boolean);
  return `${machine.label} — ${machine.manufacturer_name} ${machine.model_name} (${details.join(', ')})`;
};

const describeEntry = (entry: HistoryEntryRow): string => {
  const description =
    entry.description.length > HISTORY_ENTRY_MAX_CHARS
      ? `${entry.description.slice(0, HISTORY_ENTRY_MAX_CHARS)}…`
      : entry.description;
  return `- ${toIsoDay(entry.created_at)} ${entry.entry_type}: ${description.replace(/\s+/g, ' ')}`;
};

// The machine and its latest service history, for the prompt's
// <machine> section. Entries arrive newest first.
export const formatMachineContext = (
  machine: MachineRow,
  recentEntries: HistoryEntryRow[],
): string => {
  const history = recentEntries.length
    ? `Recent service history (newest first):\n${recentEntries.map(describeEntry).join('\n')}`
    : 'No service history recorded.';
  return `${describeMachine(machine)}\n${history}`;
};
