import { DatabaseService } from '../../database/database.service';
import {
  filterUsersWhoCanSeeMachine,
  findCaseMachineId,
} from './machineVisibility.repository';

// Of the people a message about a machine (or about a case on a machine)
// would go to, those who can see that machine. Unchanged when it's about
// no machine.
export const keepPeopleWhoCanSeeMachine = async <T extends { userId: string }>(
  databaseService: DatabaseService,
  about: { tenantId: string; machineId: string | null; caseId: string | null },
  people: T[],
): Promise<T[]> => {
  const { tenantId, caseId } = about;
  if ((!about.machineId && !caseId) || !people.length) return people;
  const visibleTo = await databaseService.withTenant(
    tenantId,
    async (client) => {
      const machineId =
        about.machineId ??
        (await findCaseMachineId(client, { tenantId, caseId: caseId! }));
      if (!machineId) return null;
      return filterUsersWhoCanSeeMachine(client, {
        tenantId,
        machineId,
        userIds: people.map((person) => person.userId),
      });
    },
  );
  return visibleTo
    ? people.filter((person) => visibleTo.has(person.userId))
    : people;
};
