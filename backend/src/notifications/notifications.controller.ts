import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwtAuthGuard';
import { CurrentUser } from '../auth/decorators/currentUser.decorator';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { NotificationsService } from './notifications.service';
import { ListNotificationsQueryDto } from './dto/listNotificationsQueryDto';

// Any signed-in user, for their own notifications only.
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  list(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: ListNotificationsQueryDto,
  ) {
    return this.notificationsService.listNotifications(actor, query);
  }

  // For the bell's badge; cheap enough to poll.
  @Get('unread-count')
  unreadCount(@CurrentUser() actor: AuthenticatedUser) {
    return this.notificationsService.countUnread(actor);
  }

  @Post('read-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  markAllRead(@CurrentUser() actor: AuthenticatedUser) {
    return this.notificationsService.markAllRead(actor);
  }

  @Post(':notificationId/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  markRead(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('notificationId', ParseUUIDPipe) notificationId: string,
  ) {
    return this.notificationsService.markRead(actor, notificationId);
  }
}
