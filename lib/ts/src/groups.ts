import { Apis, DatabaseInitialisation, Group } from '@icure/api'
import axios from 'axios'
import uuid = require('uuid')

/**
 * Creates a group with a random ID and password using the IccApi
 *
 * @param api a ICC API logged in with a user that can create groups
 * @param groupId the id of the group to create
 */
export const createGroup = async (api: Apis, groupId: string): Promise<Group> => {
  const groupName = groupId.substring(0, 5)
  const groupPwd = uuid()
  return await api.groupApi.createGroup(
    groupId,
    groupName,
    groupPwd,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    new DatabaseInitialisation({
      users: [],
      healthcareParties: [],
    }),
  )
}

/**
 * Soft deletes a group using the IccApi
 *
 * @param api a ICC API logged in with a user that can create groups
 * @param groupId the id of the group to delete
 */
export const softDeleteGroup = async (api: Apis, groupId: string): Promise<Group> => {
  return await api.groupApi.deleteGroup(groupId)
}

/**
 * Performs hard deletion of the databases of a group
 *
 * @param api a ICC API logged in with a user that can create groups
 * @param groupId the id of the group to delete
 */
export const hardDeleteGroup = async (api: Apis, groupId: string): Promise<Group> => {
  return await axios.delete(`${api.groupApi.host}/group/hard/${groupId}`, {
    headers: api.groupApi.headers.reduce((previous, current) => ({ ...previous, [current.header]: current.data }), {}),
  })
}
