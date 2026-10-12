import { AlertChannel } from '../../organisationNotifications/alertTriggerCatalog';
import {
  AlertMessage,
  DeliveryResult,
  RecipientCandidate,
} from '../types/alertTypes';

// One way of reaching a person. deliver() never throws for a missing
// address (it returns skipped); provider errors may throw and are
// recorded as failed by the dispatcher.
export interface NotificationChannel {
  readonly channel: AlertChannel;
  deliver: (
    recipient: RecipientCandidate,
    message: AlertMessage,
  ) => Promise<DeliveryResult>;
}
