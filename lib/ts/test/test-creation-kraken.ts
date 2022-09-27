import 'isomorphic-fetch'
import { setup, bootstrapCloudKraken, cleanup, setupCouchDb } from '../src'
import uuid = require('uuid')
import { before } from 'mocha'
import { Api, hex2ua, ua2hex } from '@icure/api'
import { webcrypto } from 'crypto'
import { createDeviceUser, createHealthcarePartyUser, createMasterHcpUser, createPatientUser, UserCredentials } from '../src/creation'
import { checkExistence, checkUserExistence } from './utils'
import { tmpdir } from 'os'
import { TextDecoder, TextEncoder } from 'util'
import { createGroup } from '../src/groups'
;(global as any).localStorage = new (require('node-localstorage').LocalStorage)(tmpdir(), 5 * 1024 ** 3)
;(global as any).fetch = fetch
;(global as any).Storage = ''
;(global as any).TextDecoder = TextDecoder
;(global as any).TextEncoder = TextEncoder

const groupId = uuid()
let masterCredentials: UserCredentials

describe('Test creation with Kraken', function () {
  before(async function () {
    this.timeout(300000)
    await setup('test/scratch', process.env.KRAKEN_DOCKER_URL!)
    await setupCouchDb('http://127.0.0.1:15984')
    const userId = uuid()
    await bootstrapCloudKraken(userId)
    const api = await Api('http://127.0.0.1:16044/rest/v1', 'john', 'LetMeIn', webcrypto as any, fetch)
    await createGroup(api, groupId)
    masterCredentials = await createMasterHcpUser('john', 'LetMeIn', groupId, fetch)
  })

  after(async function () {
    this.timeout(60000)
    await cleanup('test/scratch', process.env.KRAKEN_DOCKER_URL!)
  })

  it('Should be able to create a healthcare party', async () => {
    const api = await Api('http://127.0.0.1:16044/rest/v1', masterCredentials.login, masterCredentials.password, webcrypto as any, fetch)

    const { publicKey } = await api.cryptoApi.RSA.generateKeyPair()
    const publicKeyHex = ua2hex(await api.cryptoApi.RSA.exportKey(publicKey, 'spki'))

    const result = await createHealthcarePartyUser(api, `${uuid().substring(0, 6)}@icure.com`, uuid(), publicKeyHex)
    await checkExistence('127.0.0.1', 15984, `icure-${groupId}-base`, result.dataOwnerId)
    await checkUserExistence('http://127.0.0.1:16044/rest/v1', result)
  })

  it('Should be able to create a patient', async () => {
    const api = await Api('http://127.0.0.1:16044/rest/v1', masterCredentials.login, masterCredentials.password, webcrypto as any, fetch)
    api.cryptoApi.RSA.storeKeyPair(masterCredentials.dataOwnerId, {
      publicKey: api.cryptoApi.utils.spkiToJwk(hex2ua(masterCredentials.publicKey)),
      privateKey: api.cryptoApi.utils.pkcs8ToJwk(hex2ua(masterCredentials.privateKey)),
    })

    const { publicKey, privateKey } = await api.cryptoApi.RSA.generateKeyPair()
    const publicKeyHex = ua2hex(await api.cryptoApi.RSA.exportKey(publicKey, 'spki'))
    const privateKeyHex = ua2hex(await api.cryptoApi.RSA.exportKey(privateKey, 'pkcs8'))

    const result = await createPatientUser(api, `${uuid().substring(0, 6)}@icure.com`, uuid(), publicKeyHex, privateKeyHex, fetch)
    await checkExistence('127.0.0.1', 15984, `icure-${groupId}-patient`, result.dataOwnerId)
    await checkUserExistence('http://127.0.0.1:16044/rest/v1', result)
  })

  it('Should be able to create a device', async () => {
    const api = await Api('http://127.0.0.1:16044/rest/v1', masterCredentials.login, masterCredentials.password, webcrypto as any, fetch)

    const { publicKey } = await api.cryptoApi.RSA.generateKeyPair()
    const publicKeyHex = ua2hex(await api.cryptoApi.RSA.exportKey(publicKey, 'spki'))

    const result = await createDeviceUser(api, `${uuid().substring(0, 6)}@icure.com`, uuid(), publicKeyHex)
    await checkExistence('127.0.0.1', 15984, `icure-${groupId}-base`, result.dataOwnerId)
    await checkUserExistence('http://127.0.0.1:16044/rest/v1', result)
  })
})
