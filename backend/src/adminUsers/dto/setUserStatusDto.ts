import { IsIn } from 'class-validator';

export const SETTABLE_USER_STATUSES = ['active', 'disabled'] as const;
export type SettableUserStatus = (typeof SETTABLE_USER_STATUSES)[number];

export class SetUserStatusDto {
  // 'disabled' blocks sign-in; 'active' lets them back in (as 'invited'
  // if they never signed in).
  @IsIn(SETTABLE_USER_STATUSES)
  status: SettableUserStatus;
}
