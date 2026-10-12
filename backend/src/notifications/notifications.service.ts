import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import * as notificationsRepository from './notifications.repository';
import { ListNotificationsQueryDto } from './dto/listNotificationsQueryDto';
import { NotificationRow } from './types/notificationRows';
import {
  NotificationKind,
  NotificationList,
  UserNotification,
} from './types/notificationResponse';

const NOT_FOUND_MESSAGE = 'Notification not found.';

const toUserNotification = (row: NotificationRow): UserNotification => ({
  id: row.id,
  kind: row.kind as NotificationKind,
  title: row.title,
  body: row.body,
  link: row.link,
  createdAt: new Date(row.created_at).toISOString(),
  isRead: row.read_at !== null,
});

// The signed-in user's own notifications (the bell and /notifications).
@Injectable()
export class NotificationsService {
  constructor(private readonly databaseService: DatabaseService) {}

  listNotifications = (
    actor: AuthenticatedUser,
    query: ListNotificationsQueryDto,
  ): Promise<NotificationList> =>
    this.databaseService.withTenant(actor.tenantId, async (client) => {
      const owner = { tenantId: actor.tenantId, userId: actor.userId };
      // One extra row tells us whether another page exists.
      const rows = await notificationsRepository.listNotifications(client, {
        ...owner,
        unreadOnly: query.unreadOnly,
        limit: query.limit + 1,
        before: query.before ? new Date(query.before) : null,
      });
      const page = rows.slice(0, query.limit);
      return {
        items: page.map(toUserNotification),
        unreadCount: await notificationsRepository.countUnread(client, owner),
        nextBefore:
          rows.length > query.limit
            ? new Date(page[page.length - 1].created_at).toISOString()
            : null,
      };
    });

  countUnread = async (
    actor: AuthenticatedUser,
  ): Promise<{ count: number }> => ({
    count: await this.databaseService.withTenant(actor.tenantId, (client) =>
      notificationsRepository.countUnread(client, {
        tenantId: actor.tenantId,
        userId: actor.userId,
      }),
    ),
  });

  markRead = async (
    actor: AuthenticatedUser,
    notificationId: string,
  ): Promise<void> => {
    const found = await this.databaseService.withTenant(
      actor.tenantId,
      (client) =>
        notificationsRepository.markRead(client, {
          tenantId: actor.tenantId,
          userId: actor.userId,
          notificationId,
        }),
    );
    if (!found) throw new NotFoundException(NOT_FOUND_MESSAGE);
  };

  markAllRead = (actor: AuthenticatedUser): Promise<void> =>
    this.databaseService.withTenant(actor.tenantId, (client) =>
      notificationsRepository.markAllRead(client, {
        tenantId: actor.tenantId,
        userId: actor.userId,
      }),
    );
}
