import { DemoRequestRow } from './types/demoRequestRows';
import { DemoRequest } from './types/demoRequestResponse';

export const toDemoRequest = (row: DemoRequestRow): DemoRequest => ({
  id: row.id,
  email: row.email,
  firstName: row.first_name,
  lastName: row.last_name,
  company: row.company,
  country: row.country,
  phone: row.phone,
  message: row.message,
  status: row.status,
  notes: row.notes,
  teamEmailSentAt: row.team_email_sent_at?.toISOString() ?? null,
  userEmailSentAt: row.user_email_sent_at?.toISOString() ?? null,
  ipAddress: row.ip_address,
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString(),
});
