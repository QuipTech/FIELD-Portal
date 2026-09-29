import { Module } from '@nestjs/common';
import { AdminSubscriptionsController } from './adminSubscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';

@Module({
  controllers: [AdminSubscriptionsController],
  providers: [SubscriptionsService],
})
export class AdminSubscriptionsModule {}
