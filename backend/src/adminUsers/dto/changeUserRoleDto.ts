import { IsUUID } from 'class-validator';

export class ChangeUserRoleDto {
  // A system role or one of the user's organisation's own.
  @IsUUID()
  roleId: string;
}
