import 'isomorphic-fetch'
import { setup, bootstrapCloudKraken, cleanup, setupCouchDb } from '../src'
import uuid = require('uuid')
import { before } from 'mocha'
import { Api, hex2ua, pkcs8ToJwk, spkiToJwk } from '@icure/api'
import { webcrypto } from 'crypto'
import { createDeviceUser, createHealthcarePartyUser, createMasterHcpUser, createPatientUser, UserCredentials } from '../src/creation'
import { checkExistence, checkPatientExistence, checkUserExistence, generateKeysAsString, setLocalStorage } from './utils'
import { createGroup } from '../src/groups'
import { expect } from 'chai'

setLocalStorage(fetch)

const groupId = process.env.ICURE_TEST_GROUP_ID!
let masterCredentials: UserCredentials
const iCureUrl = process.env.ICURE_TEST_URL!

describe('Test creation with Acceptance', function () {
  before(async function () {
    this.timeout(60000)
    masterCredentials = await createMasterHcpUser(process.env.ICURE_TEST_ADMIN_LOGIN!, process.env.ICURE_TEST_ADMIN_PWD!, groupId, fetch, iCureUrl)
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
    await api.cryptoApi.storeKeyPair(`${masterCredentials.dataOwnerId}.${masterCredentials.publicKey.slice(-32)}`, jwk)

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
