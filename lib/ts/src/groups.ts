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
 * @param adminLogin a database admin login
 * @param adminPassword the admin user password
 * @param groupId the group to delete
 * @param couchDbUrl the couchDbUrl
 */
export const hardDeleteGroup = async (adminLogin: string, adminPassword: string, groupId: string, couchDbUrl = 'http://127.0.0.1:15984') => {
  await axios.delete(`${couchDbUrl}/icure-${groupId}-base`, {
    auth: { username: adminLogin, password: adminPassword },
    headers: {
      'Content-Type': 'application/json',
    },
  })

  await axios.delete(`${couchDbUrl}/icure-${groupId}-healthdata`, {
    auth: { username: adminLogin, password: adminPassword },
    headers: {
      'Content-Type': 'application/json',
    },
  })

  await axios.delete(`${couchDbUrl}/icure-${groupId}-patient`, {
    auth: { username: adminLogin, password: adminPassword },
    headers: {
      'Content-Type': 'application/json',
    },
  })
}
