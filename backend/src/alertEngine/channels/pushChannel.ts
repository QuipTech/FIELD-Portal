import { Injectable } from '@nestjs/common';
import { NotificationChannel } from './notificationChannel';
import { DeliveryResult } from '../types/alertTypes';

// Mobile push isn't connected yet (FCM comes later): every push is
// recorded as skipped. The in-app bell still gets the alert.
@Injectable()
export class PushChannel implements NotificationChannel {
  readonly channel = 'push' as const;

  deliver = (): Promise<DeliveryResult> =>
    Promise.resolve({
      status: 'skipped',
      error: 'Push provider not connected yet',
    });
}
