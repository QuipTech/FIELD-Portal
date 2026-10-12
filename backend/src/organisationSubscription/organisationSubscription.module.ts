import { Module } from '@nestjs/common';
import { OrganisationSubscriptionController } from './organisationSubscription.controller';
import { OrganisationSubscriptionService } from './organisationSubscription.service';

@Module({
  controllers: [OrganisationSubscriptionController],
  providers: [OrganisationSubscriptionService],
})
export class OrganisationSubscriptionModule {}
