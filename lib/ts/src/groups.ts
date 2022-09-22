import { Api, DatabaseInitialisation, Group } from '@icure/api';
import axios from 'axios';
import uuid = require('uuid');

/**
 * Creates a group with a random ID and password using the IccApi
 *
 * @param adminLogin the login of an admin user
 * @param adminPassword the password of the user
 * @param groupId the id of the group to create
 * @param fetchImpl the implementation of the fetch function
 * @param host the Kraken API URL
 */
export const createGroup = async (
  adminLogin: string,
  adminPassword: string,
  groupId: string,
  fetchImpl?: (input: RequestInfo, init?: RequestInit) => Promise<Response>,
  host = 'http://127.0.0.1:16044/rest/v1'
): Promise<Group> => {
  const api = await Api(host, adminLogin, adminPassword, undefined, fetchImpl);
  const groupName = groupId.substring(0,5);
  const groupPwd = uuid();
  return await api.groupApi.createGroup(
    groupId,
    groupName,
    groupPwd,
    undefined, undefined, undefined, undefined, undefined,
    new DatabaseInitialisation({
      users: [],
      healthcareParties: []
    }));
};

/**
 * Soft deletes a group using the IccApi
 *
 * @param adminLogin the login of an admin user
 * @param adminPassword the password of the user
 * @param groupId the id of the group to delete
 * @param fetchImpl the implementation of the fetch function
 * @param host the Kraken API URL
 */
export const softDeleteGroup = async (
  adminLogin: string,
  adminPassword: string,
  groupId: string,
  fetchImpl?: (input: RequestInfo, init?: RequestInit) => Promise<Response>,
  host = 'http://127.0.0.1:16044/rest/v1'
): Promise<Group> => {
  const api = await Api(host, adminLogin, adminPassword, undefined, fetchImpl);
  return await api.groupApi.deleteGroup(groupId);
};

/**
 * Performs hard deletion of the databases of a group
 *
 * @param adminLogin a database admin login
 * @param adminPassword the admin user password
 * @param groupId the group to delete
 * @param couchDbUrl the couchDbUrl
 */
export const hardDeleteGroup = async (
  adminLogin: string,
  adminPassword: string,
  groupId: string,
  couchDbUrl = 'http://127.0.0.1:15984'
) => {
  await axios
    .delete(
      `${couchDbUrl}/icure-${groupId}-base`,
      {
        auth: { username: adminLogin, password: adminPassword },
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

  await axios
    .delete(
      `${couchDbUrl}/icure-${groupId}-healthdata`,
      {
        auth: { username: adminLogin, password: adminPassword },
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

  await axios
    .delete(
      `${couchDbUrl}/icure-${groupId}-patient`,
      {
        auth: { username: adminLogin, password: adminPassword },
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
};
