import apiClient from './client';

export const getAllGroups = () => apiClient.get<string[]>('/api/user/groups');
export const getUserGroup = () => apiClient.get<string>('/api/user/group');
export const updateUserGroup = (groupName: string) => 
  apiClient.put('/api/user/group', { groupName });