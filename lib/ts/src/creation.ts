import { Api, Apis, HealthcareParty, Patient, User } from '@icure/api';
import uuid = require('uuid');
import { retry } from './index';

export interface MasterCredentials {
  login: string;
  password: string;
}

/**
 * Creates a new User with a related patient using the provided parameters
 *
 * @param responsibleLogin the login of the HCP responsible for the patient
 * @param responsiblePassword the password of the HCP responsible for the patient
 * @param userLogin the login of the user
 * @param userToken the auth token that will be assigned to the user
 * @param firstName the first name of the user
 * @param lastName the last name of the user
 * @param publicKey the public key to use for the user
 * @param fetchImpl the implementation of the fetch function
 * @param host the Kraken API URL
 */
export const createPatient = async (
  responsibleLogin: string,
  responsiblePassword: string,
  userLogin: string,
  userToken: string,
  firstName: string,
  lastName: string,
  publicKey: string,
  fetchImpl?: (input: RequestInfo, init?: RequestInit) => Promise<Response>,
  host = 'http://127.0.0.1:16044/rest/v1'
) => {
  const api = await Api(host, responsibleLogin, responsiblePassword, undefined, fetchImpl);
  const user = await api.userApi.getCurrentUser();
  const patient = (await api.patientApi.createPatientWithUser(
    user,
    new Patient({
      id: uuid(),
      firstName: firstName,
      lastName: lastName,
      publicKey: publicKey
    })
  )) as Patient;
  const patientUser = await api.userApi.createUser(
    new User({
      id: uuid(),
      name: userLogin,
      login: userLogin,
      patientId: patient.id,
    })
  );
  await api.userApi.getToken(patientUser.id!, uuid(), 24 * 60 * 60, userToken);
};

/**
 * Creates a HCP directly using the admin user
 *
 * @param adminLogin the admin login
 * @param adminPassword the admin password
 * @param groupId the group where to create the HCP
 * @param fetchImpl the implementation of the fetch function
 * @param host the Kraken API URL
 */
export const createMasterHcp = async (
  adminLogin: string,
  adminPassword: string,
  groupId: string,
  fetchImpl?: (input: RequestInfo, init?: RequestInit) => Promise<Response>,
  host = 'http://127.0.0.1:16044/rest/v1'
): Promise<MasterCredentials> => {
  const api = await Api(host, adminLogin, adminPassword, undefined, fetchImpl);
  const hcpId = uuid();
  const masterLogin = `master@${hcpId.substring(0,6)}.icure`;
  const masterUser = await api.userApi.createUserInGroup(
    groupId,
    new User({
      id: uuid(),
      name: `Master HCP`,
      login: masterLogin,
      email: masterLogin,
      healthcarePartyId: hcpId
    })
  );
  const token = await api.userApi.getTokenInGroup(groupId, masterUser.id!, uuid(), uuid(), 24 * 60 * 60);
  await retry(async () => {
    const masterApi = await Api(host, masterLogin, token, undefined, fetchImpl);
    const hcp = await masterApi.healthcarePartyApi.createHealthcareParty(
      new HealthcareParty({
        id: hcpId,
        firstName: 'Master',
        lastName: 'HCP',
      })
    );
  });

  return { login: masterLogin, password: token };

}

/**
 * Creates a new User with a related patient using the provided parameters
 *
 * @param responsibleLogin the login of a user that can create a HCP
 * @param responsiblePassword the password of the user that can create a HCP
 * @param userLogin the login of the user
 * @param userToken the auth token that will be assigned to the user
 * @param publicKey the public key to use for the user
 * @param fetchImpl the implementation of the fetch function
 * @param host the Kraken API URL
 */
export const createHealthcareParty = async (
  responsibleLogin: string,
  responsiblePassword: string,
  userLogin: string,
  userToken: string,
  publicKey: string,
  fetchImpl?: (input: RequestInfo, init?: RequestInit) => Promise<Response>,
  host = 'http://127.0.0.1:16044/rest/v1'
): Promise<User> => {
  const api = await Api(host, responsibleLogin, responsiblePassword, undefined, fetchImpl);
  const hcp = await api.healthcarePartyApi.createHealthcareParty(
    new HealthcareParty({
      id: uuid(),
      firstName: uuid().substring(0,6),
      lastName: uuid().substring(0,6),
      publicKey: publicKey,
    })
  );
  const hcpUser = await api.userApi.createUser(
    new User({
      id: uuid(),
      name: userLogin,
      login: userLogin,
      healthcarePartyId: hcp.id,
    })
  );
  await api.userApi.getToken(hcpUser.id!, uuid(), 24 * 60 * 60, userToken);
  return hcpUser;
};
