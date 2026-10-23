import { IsUUID } from 'class-validator';

// POST /machines/:machineId/technicians
export class AssignTechnicianDto {
  // Someone in the caller's organisation.
  @IsUUID()
  userId!: string;
}
