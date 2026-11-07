import { apiRequest } from "./httpClient";
import type {
  AssignmentTargetType,
  GroupActivity,
  GroupAssignment,
  GroupMachine,
  MachineGroup,
  MachineGroupChanges,
  MachineGroupMembership,
  PlatformMachine,
  ShareAccessLevel,
} from "../types/machineGroup";

// Admin view → Machine groups: the platform administrator's global groups
// (backend src/machineSharing). Every change applies on people's next
// request.
const authorizationHeader = (accessToken: string) => ({ Authorization: `Bearer ${accessToken}` });
const groupPath = (groupId: string) => `/admin/machine-groups/${groupId}`;

export const listMachineGroupsRequest = (accessToken: string) =>
  apiRequest<MachineGroup[]>("/admin/machine-groups", { headers: authorizationHeader(accessToken) });

export const getMachineGroupRequest = (accessToken: string, groupId: string) =>
  apiRequest<MachineGroup>(groupPath(groupId), { headers: authorizationHeader(accessToken) });

// 409 when a live group already has the name (ignoring case).
export const createMachineGroupRequest = (accessToken: string, group: MachineGroupChanges) =>
  apiRequest<MachineGroup>("/admin/machine-groups", {
    method: "POST",
    headers: authorizationHeader(accessToken),
    body: JSON.stringify(group),
  });

export const updateMachineGroupRequest = (accessToken: string, groupId: string, changes: MachineGroupChanges) =>
  apiRequest<MachineGroup>(groupPath(groupId), {
    method: "PATCH",
    headers: authorizationHeader(accessToken),
    body: JSON.stringify(changes),
  });

// Ends every assignment of the group, so nobody sees its machines any more.
export const deleteMachineGroupRequest = (accessToken: string, groupId: string) =>
  apiRequest<null>(groupPath(groupId), { method: "DELETE", headers: authorizationHeader(accessToken) });

export const listGroupActivityRequest = (accessToken: string, groupId: string) =>
  apiRequest<GroupActivity[]>(`${groupPath(groupId)}/activity`, { headers: authorizationHeader(accessToken) });

export const listGroupMachinesRequest = (accessToken: string, groupId: string) =>
  apiRequest<GroupMachine[]>(`${groupPath(groupId)}/machines`, { headers: authorizationHeader(accessToken) });

// Machines from any organisation; ones already in the group are skipped.
export const addGroupMachinesRequest = (accessToken: string, groupId: string, machineIds: string[]) =>
  apiRequest<GroupMachine[]>(`${groupPath(groupId)}/machines`, {
    method: "POST",
    headers: authorizationHeader(accessToken),
    body: JSON.stringify({ machineIds }),
  });

export const removeGroupMachineRequest = (accessToken: string, groupId: string, machineId: string) =>
  apiRequest<null>(`${groupPath(groupId)}/machines/${machineId}`, {
    method: "DELETE",
    headers: authorizationHeader(accessToken),
  });

export const listGroupAssignmentsRequest = (accessToken: string, groupId: string) =>
  apiRequest<GroupAssignment[]>(`${groupPath(groupId)}/assignments`, { headers: authorizationHeader(accessToken) });

// Assigning a target that already has the group changes its level.
export const assignGroupRequest = (
  accessToken: string,
  groupId: string,
  assignment: { targetType: AssignmentTargetType; targetId: string; accessLevel: ShareAccessLevel },
) =>
  apiRequest<GroupAssignment[]>(`${groupPath(groupId)}/assignments`, {
    method: "POST",
    headers: authorizationHeader(accessToken),
    body: JSON.stringify(assignment),
  });

export const revokeGroupAssignmentRequest = (
  accessToken: string,
  target: { groupId: string; assignmentId: string },
  reason: string,
) =>
  apiRequest<null>(`${groupPath(target.groupId)}/assignments/${target.assignmentId}`, {
    method: "DELETE",
    headers: authorizationHeader(accessToken),
    body: JSON.stringify({ reason }),
  });

// Plant ID, fleet number, serial, VIN or organisation name, across every
// organisation.
export const searchPlatformMachinesRequest = (accessToken: string, search: string) =>
  apiRequest<PlatformMachine[]>(`/admin/machines/search?${new URLSearchParams({ search, limit: "50" })}`, {
    headers: authorizationHeader(accessToken),
  });

export const getMachineGroupsRequest = (accessToken: string, machineId: string) =>
  apiRequest<MachineGroupMembership[]>(`/admin/machines/${machineId}/groups`, {
    headers: authorizationHeader(accessToken),
  });

// Makes the machine's groups exactly these, in one go; empty leaves them all.
export const setMachineGroupsRequest = (accessToken: string, machineId: string, groupIds: string[]) =>
  apiRequest<MachineGroupMembership[]>(`/admin/machines/${machineId}/groups`, {
    method: "PUT",
    headers: authorizationHeader(accessToken),
    body: JSON.stringify({ groupIds }),
  });
