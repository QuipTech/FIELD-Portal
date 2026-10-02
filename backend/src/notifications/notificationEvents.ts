// Each signed-in user's own room on the /notifications socket.
export const userRoom = (userId: string) => `user:${userId}`;

export const NOTIFICATION_EVENTS = {
  // A notification was created for this user; the portal refetches.
  created: 'notification:new',
} as const;

// The Postgres channel migration 0065's trigger announces new rows on.
export const NOTIFICATION_PG_CHANNEL = 'user_notification';
