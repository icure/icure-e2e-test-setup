import { Api, Apis, Device, HealthcareParty, hex2ua, Patient, ua2hex, User } from '@icure/api'
import uuid = require('uuid')
import { retry } from './index'
import { webcrypto } from 'crypto'

export interface MasterCredentials {
  login: string
  password: string
  hcpId: string
  publicKey: string
  privateKey: string
}

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
  host = 'http://127.0.0.1:16044/rest/v1',
): Promise<MasterCredentials> => {
  const api = await Api(host, adminLogin, adminPassword, webcrypto as any, fetchImpl)
  const hcpId = uuid()
  const masterLogin = `master@${hcpId.substring(0, 6)}.icure`
  const masterUser = await api.userApi.createUserInGroup(
    groupId,
    new User({
      id: uuid(),
      name: `Master HCP`,
      login: masterLogin,
      email: masterLogin,
      healthcarePartyId: hcpId,
    }),
  )
  const token = await api.userApi.getTokenInGroup(groupId, masterUser.id!, uuid(), uuid(), 24 * 60 * 60)
  const { publicKey, privateKey } = await api.cryptoApi.RSA.generateKeyPair()
  const publicKeyHex = ua2hex(await api.cryptoApi.RSA.exportKey(publicKey, 'spki'))
  const privateKeyHex = ua2hex(await api.cryptoApi.RSA.exportKey(privateKey, 'pkcs8'))
  await retry(async () => {
    const masterApi = await Api(host, masterLogin, token, undefined, fetchImpl)
    await masterApi.healthcarePartyApi.createHealthcareParty(
      new HealthcareParty({
        id: hcpId,
        firstName: 'Master',
        lastName: 'HCP',
        publicKey: publicKeyHex,
      }),
    )
  }, 5)

  return { login: masterLogin, password: token, hcpId: hcpId, publicKey: publicKeyHex, privateKey: privateKeyHex }
}

/**
 * Creates a new User with a related Patient using the provided parameters
 *
 * @param hcpApi: an instance of the Icc Api with the hcp credentials and keys
 * @param userLogin the login of the user
 * @param userToken the auth token that will be assigned to the user
 * @param publicKey the public key to use for the user
 * @param privateKey the private key to use for the user
 * @param fetchImpl the implementation of the fetch function
 * @param host the Kraken API URL
 */
export const createPatient = async (
  hcpApi: Apis,
  userLogin: string,
  userToken: string,
  publicKey: string,
  privateKey: string,
  fetchImpl?: (input: RequestInfo, init?: RequestInit) => Promise<Response>,
  host = 'http://127.0.0.1:16044/rest/v1',
): Promise<User> => {
  const user = await hcpApi.userApi.getCurrentUser()
  const rawPatient = new Patient({
    id: uuid(),
    firstName: uuid().substring(0, 6),
    lastName: uuid().substring(0, 6),
    publicKey: publicKey,
  })
  const patient = (await hcpApi.patientApi.createPatientWithUser(user, await hcpApi.patientApi.newInstance(user, rawPatient))) as Patient
  const patientUser = await hcpApi.userApi.createUser(
    new User({
      id: uuid(),
      name: uuid().substring(0, 6),
      login: userLogin,
      email: userLogin,
      patientId: patient.id,
    }),
  )
  await hcpApi.userApi.getToken(patientUser.id!, uuid(), 24 * 60 * 60, userToken)

  const api = await Api(host, userLogin, userToken, webcrypto as any, fetchImpl)
  api.cryptoApi.RSA.storeKeyPair(patient.id!, {
    publicKey: api.cryptoApi.utils.spkiToJwk(hex2ua(publicKey)),
    privateKey: api.cryptoApi.utils.pkcs8ToJwk(hex2ua(privateKey)),
  })

  const patientWithDelegations = await api.patientApi.initDelegations(patient, patientUser)
  const currentPatient = await api.patientApi.getPatientRaw(patient.id!)
  const patientToUpdate = await api.patientApi.initEncryptionKeys(
    patientUser,
    new Patient({ ...currentPatient, delegations: Object.assign(patientWithDelegations.delegations ?? {}, currentPatient.delegations) }),
  )

  await hcpApi.patientApi.modifyPatientWithUser(user, patientToUpdate)

  return patientUser
}

/**
 * Creates a new User with a related Healthcare Party using the provided parameters
 *
 * @param api: an instance of the Icc Api
 * @param userLogin the login of the user
 * @param userToken the auth token that will be assigned to the user
 * @param publicKey the public key to use for the user
 */
export const createHealthcareParty = async (api: Apis, userLogin: string, userToken: string, publicKey: string): Promise<User> => {
  const hcp = await api.healthcarePartyApi.createHealthcareParty(
    new HealthcareParty({
      id: uuid(),
      firstName: uuid().substring(0, 6),
      lastName: uuid().substring(0, 6),
      publicKey: publicKey,
    }),
  )
  const hcpUser = await api.userApi.createUser(
    new User({
      id: uuid(),
      name: userLogin,
      login: userLogin,
      email: userLogin,
      healthcarePartyId: hcp.id,
    }),
  )
  await api.userApi.getToken(hcpUser.id!, uuid(), 24 * 60 * 60, userToken)
  return hcpUser
}

/**
 * Creates a new User with a related Device using the provided parameters
 *
 * @param api: an instance of the Icc Api
 * @param userLogin the login of the user
 * @param userToken the auth token that will be assigned to the user
 * @param publicKey the public key to use for the user
 */
export const createDevice = async (api: Apis, userLogin: string, userToken: string, publicKey: string): Promise<User> => {
  const device = await api.deviceApi.createDevice(
    new Device({
      id: uuid(),
      serialNumber: uuid().substring(0, 6),
      publicKey: publicKey,
    }),
  )
  const deviceUser = await api.userApi.createUser(
    new User({
      id: uuid(),
      name: userLogin,
      login: userLogin,
      email: userLogin,
      deviceId: device.id,
    }),
  )
  await api.userApi.getToken(deviceUser.id!, uuid(), 24 * 60 * 60, userToken)
  return deviceUser
}