import { IsIn } from 'class-validator';
import {
  OPERATING_STATUSES,
  OperatingStatus,
} from '../types/machineFleetResponse';

export class UpdateMachineStatusDto {
  @IsIn(OPERATING_STATUSES)
  status: OperatingStatus;
}
