import { IsIn, IsOptional } from 'class-validator';
import {
  SUBSCRIPTION_STATUSES,
  SubscriptionStatus,
} from '../types/subscriptionResponse';

export class ListSubscriptionsQueryDto {
  @IsOptional()
  @IsIn(SUBSCRIPTION_STATUSES)
  status?: SubscriptionStatus;
}
