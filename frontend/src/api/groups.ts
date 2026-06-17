import apiClient from './client';

export interface UserGroupResponse {
  group: string;
}

export const getAllGroups = () => apiClient.get<string[]>('/api/user/groups');
export const getUserGroup = () => apiClient.get<UserGroupResponse>('/api/user/group');
export const updateUserGroup = (groupName: string) =>
  apiClient.put('/api/user/group', { groupName });
