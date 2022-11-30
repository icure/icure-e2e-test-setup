import 'isomorphic-fetch'
import { setup, bootstrapCloudKraken, cleanup, setupCouchDb } from '../src'
import uuid = require('uuid')
import { before } from 'mocha'
import { Api, hex2ua, pkcs8ToJwk, spkiToJwk } from '@icure/api'
import { webcrypto } from 'crypto'
import { createDeviceUser, createHealthcarePartyUser, createMasterHcpUser, createPatientUser, UserCredentials } from '../src/creation'
import { checkExistence, checkPatientExistence, checkUserExistence, generateKeysAsString, setLocalStorage } from './utils'
import { createGroup } from '../src/groups'

setLocalStorage(fetch)

const dockerComposeUrl = 'https://raw.githubusercontent.com/icure/icure-e2e-test-setup/arm64/docker-compose-cloud.yaml'
const groupId = uuid()
let masterCredentials: UserCredentials

describe('Test creation with Kraken', function () {
  before(async function () {
    this.timeout(300000)
    await setup('test/scratch', dockerComposeUrl)
    await setupCouchDb('http://127.0.0.1:15984')
    const userId = uuid()
    await bootstrapCloudKraken(userId)
    const api = await Api('http://127.0.0.1:16044/rest/v1', 'john', 'LetMeIn', webcrypto as any, fetch)
    await createGroup(api, groupId)
    masterCredentials = await createMasterHcpUser('john', 'LetMeIn', groupId, fetch)
  })

  after(async function () {
    this.timeout(60000)
    await cleanup('test/scratch', dockerComposeUrl)
  })

  it('Should be able to create a healthcare party', async () => {
    const api = await Api('http://127.0.0.1:16044/rest/v1', masterCredentials.login, masterCredentials.password, webcrypto as any, fetch)

    const result = await createHealthcarePartyUser(api, `${uuid()}@icure.com`, uuid())
    await checkExistence('127.0.0.1', 15984, `icure-${groupId}-base`, result.dataOwnerId)
    await checkUserExistence('http://127.0.0.1:16044/rest/v1', result)
  }).timeout(60000)

  it('Should be able to create a patient', async () => {
    const api = await Api('http://127.0.0.1:16044/rest/v1', masterCredentials.login, masterCredentials.password, webcrypto as any, fetch)
    const jwk = {
      publicKey: spkiToJwk(hex2ua(masterCredentials.publicKey)),
      privateKey: pkcs8ToJwk(hex2ua(masterCredentials.privateKey)),
    }
    await api.cryptoApi.cacheKeyPair(jwk)
    await api.cryptoApi.keyStorage.storeKeyPair(`${masterCredentials.dataOwnerId}.${masterCredentials.publicKey.slice(-32)}`, jwk)

    const { publicKeyHex, privateKeyHex } = await generateKeysAsString(api)

    const result = await createPatientUser(api, `${uuid()}@icure.com`, uuid(), publicKeyHex, privateKeyHex, fetch)
    await checkExistence('127.0.0.1', 15984, `icure-${groupId}-patient`, result.dataOwnerId)
    await checkUserExistence('http://127.0.0.1:16044/rest/v1', result)
    await checkPatientExistence('http://127.0.0.1:16044/rest/v1', result)
  }).timeout(60000)

  it('Should be able to create a device', async () => {
    const api = await Api('http://127.0.0.1:16044/rest/v1', masterCredentials.login, masterCredentials.password, webcrypto as any, fetch)

    const result = await createDeviceUser(api, `${uuid()}@icure.com`, uuid())
    await checkExistence('127.0.0.1', 15984, `icure-${groupId}-base`, result.dataOwnerId)
    await checkUserExistence('http://127.0.0.1:16044/rest/v1', result)
  }).timeout(60000)
})
