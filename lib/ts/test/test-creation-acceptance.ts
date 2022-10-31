import 'isomorphic-fetch'
import uuid = require('uuid')
import { before } from 'mocha'
import { Api, hex2ua, KeyStorageImpl, LocalStorageImpl, pkcs8ToJwk, spkiToJwk } from '@icure/api'
import { webcrypto } from 'crypto'
import { createDeviceUser, createHealthcarePartyUser, createMasterHcpUser, createPatientUser, UserCredentials } from '../src/creation'
import { generateKeysAsString, setLocalStorage } from './utils'
import { expect } from 'chai'
import { createGroup, hardDeleteGroup } from '../src/groups'

setLocalStorage(fetch)

const groupId = `test-e2e-${uuid()}`
let masterCredentials: UserCredentials
const iCureUrl = process.env.ICURE_TEST_URL!

describe('Test creation with Acceptance', function () {
  before(async function () {
    this.timeout(60000)
    const adminApi = await Api(iCureUrl, process.env.ICURE_TEST_ADMIN_LOGIN!, process.env.ICURE_TEST_ADMIN_PWD!, webcrypto as any, fetch)

    const group = await createGroup(adminApi, groupId)
    expect(!!group).to.be.true
    expect(group.id).to.eq(groupId)

    masterCredentials = await createMasterHcpUser(process.env.ICURE_TEST_ADMIN_LOGIN!, process.env.ICURE_TEST_ADMIN_PWD!, groupId, fetch, iCureUrl)
  })

  after(async function () {
    this.timeout(60000)
    const adminApi = await Api(iCureUrl, process.env.ICURE_TEST_ADMIN_LOGIN!, process.env.ICURE_TEST_ADMIN_PWD!, webcrypto as any, fetch)

    const response = await hardDeleteGroup(adminApi, groupId)
    expect(!!response).to.be.true
    expect(response.status).to.eq(200)
  })

  it('Should be able to create a healthcare party', async () => {
    const api = await Api(iCureUrl, masterCredentials.login, masterCredentials.password, webcrypto as any, fetch)

    const { publicKeyHex } = await generateKeysAsString(api)
    const userLogin = `${uuid().substring(0, 6)}@icure.com`

    const result = await createHealthcarePartyUser(api, userLogin, uuid(), publicKeyHex)
    expect(!!result).to.eq(true)
    expect(result.login).to.eq(userLogin)
  }).timeout(60000)

  it('Should be able to create a patient', async () => {
    const api = await Api(iCureUrl, masterCredentials.login, masterCredentials.password, webcrypto as any, fetch)
    const jwk = {
      publicKey: spkiToJwk(hex2ua(masterCredentials.publicKey)),
      privateKey: pkcs8ToJwk(hex2ua(masterCredentials.privateKey)),
    }
    await api.cryptoApi.cacheKeyPair(jwk)
    await api.cryptoApi.keyStorage.storeKeyPair(`${masterCredentials.dataOwnerId}.${masterCredentials.publicKey.slice(-32)}`, jwk)

    const { publicKeyHex, privateKeyHex } = await generateKeysAsString(api)
    const userLogin = `${uuid().substring(0, 6)}@icure.com`

    const result = await createPatientUser(api, userLogin, uuid(), publicKeyHex, privateKeyHex, fetch, iCureUrl)
    expect(!!result).to.eq(true)
    expect(result.login).to.eq(userLogin)
  }).timeout(60000)

  it('Should be able to create a device', async () => {
    const api = await Api(iCureUrl, masterCredentials.login, masterCredentials.password, webcrypto as any, fetch)

    const { publicKeyHex } = await generateKeysAsString(api)
    const userLogin = `${uuid().substring(0, 6)}@icure.com`

    const result = await createDeviceUser(api, userLogin, uuid(), publicKeyHex)
    expect(!!result).to.eq(true)
    expect(result.login).to.eq(userLogin)
  }).timeout(60000)
})
