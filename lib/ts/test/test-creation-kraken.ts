import 'isomorphic-fetch'
import { setup, bootstrapCloudKraken, cleanup, setupCouchDb } from '../src'
import uuid = require('uuid')
import { before } from 'mocha'
import { Api, hex2ua, ua2hex } from '@icure/api'
import { webcrypto } from 'crypto'
import { createDevice, createHealthcareParty, createMasterHcp, createPatient, MasterCredentials } from '../src/creation'
import { checkExistence } from './utils'
import { tmpdir } from 'os'
import { TextDecoder, TextEncoder } from 'util'
import { createGroup } from '../dist'
;(global as any).localStorage = new (require('node-localstorage').LocalStorage)(tmpdir(), 5 * 1024 ** 3)
;(global as any).fetch = fetch
;(global as any).Storage = ''
;(global as any).TextDecoder = TextDecoder
;(global as any).TextEncoder = TextEncoder

const groupId = uuid()
let masterCredentials: MasterCredentials

describe('Test creation', function () {
  before(async function () {
    this.timeout(300000)
    await setup('test/scratch', process.env.KRAKEN_DOCKER_URL!)
    await setupCouchDb('http://127.0.0.1:15984')
    const userId = uuid()
    await bootstrapCloudKraken(userId)
    await createGroup('john', 'LetMeIn', groupId, fetch)
    masterCredentials = await createMasterHcp('john', 'LetMeIn', groupId, fetch)
  })

  after(async function () {
    this.timeout(60000)
    await cleanup('test/scratch', process.env.KRAKEN_DOCKER_URL!)
  })

  it('Should be able to create a healthcare party', async () => {
    const api = await Api('http://127.0.0.1:16044/rest/v1', masterCredentials.login, masterCredentials.password, webcrypto as any, fetch)

    const { publicKey } = await api.cryptoApi.RSA.generateKeyPair()
    const publicKeyHex = ua2hex(await api.cryptoApi.RSA.exportKey(publicKey, 'spki'))

    const result = await createHealthcareParty(api, `${uuid().substring(0, 6)}@icure.com`, uuid(), publicKeyHex)
    await checkExistence('127.0.0.1', 15984, `icure-${groupId}-base`, result.dataOwnerId)
    await checkExistence('127.0.0.1', 15984, `icure-${groupId}-base`, result.userId)
  })

  it('Should be able to create a patient', async () => {
    const api = await Api('http://127.0.0.1:16044/rest/v1', masterCredentials.login, masterCredentials.password, webcrypto as any, fetch)
    api.cryptoApi.RSA.storeKeyPair(masterCredentials.hcpId, {
      publicKey: api.cryptoApi.utils.spkiToJwk(hex2ua(masterCredentials.publicKey)),
      privateKey: api.cryptoApi.utils.pkcs8ToJwk(hex2ua(masterCredentials.privateKey)),
    })

    const { publicKey, privateKey } = await api.cryptoApi.RSA.generateKeyPair()
    const publicKeyHex = ua2hex(await api.cryptoApi.RSA.exportKey(publicKey, 'spki'))
    const privateKeyHex = ua2hex(await api.cryptoApi.RSA.exportKey(privateKey, 'pkcs8'))

    const result = await createPatient(api, `${uuid().substring(0, 6)}@icure.com`, uuid(), publicKeyHex, privateKeyHex, fetch)
    await checkExistence('127.0.0.1', 15984, `icure-${groupId}-patient`, result.dataOwnerId)
    await checkExistence('127.0.0.1', 15984, `icure-${groupId}-base`, result.userId)
  })

  it('Should be able to create a device', async () => {
    const api = await Api('http://127.0.0.1:16044/rest/v1', masterCredentials.login, masterCredentials.password, webcrypto as any, fetch)

    const { publicKey } = await api.cryptoApi.RSA.generateKeyPair()
    const publicKeyHex = ua2hex(await api.cryptoApi.RSA.exportKey(publicKey, 'spki'))

    const result = await createDevice(api, `${uuid().substring(0, 6)}@icure.com`, uuid(), publicKeyHex)
    await checkExistence('127.0.0.1', 15984, `icure-${groupId}-base`, result.dataOwnerId)
    await checkExistence('127.0.0.1', 15984, `icure-${groupId}-base`, result.userId)
  })
})
