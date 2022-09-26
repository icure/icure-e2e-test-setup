import 'isomorphic-fetch'
import uuid = require('uuid')
import { setup, bootstrapOssKraken, setupCouchDb, cleanup } from '../src'
import { tmpdir } from 'os'
import { Api, hex2ua, ua2hex } from '@icure/api'
import { createDevice, createHealthcareParty, createPatient } from '../src/creation'
import { checkExistence } from './utils'
import { webcrypto } from 'crypto'

;(global as any).localStorage = new (require('node-localstorage').LocalStorage)(tmpdir(), 5 * 1024 ** 3)
;(global as any).fetch = fetch
;(global as any).Storage = ''
;(global as any).TextDecoder = TextDecoder
;(global as any).TextEncoder = TextEncoder

const hcpLogin = `${uuid().substring(0, 6)}@icure.com`
let hcpPwd = uuid()
let hcpPrivateKey: string | undefined
let hcpPubKey: string | undefined
let hcpId: string | undefined

describe('Test creation', function () {
  before(async function () {
    this.timeout(300000)
    await setup('test/scratch', process.env.OSS_DOCKER_URL!)
    await setupCouchDb('http://127.0.0.1:15984')
    const userId = uuid()
    await bootstrapOssKraken(userId)
    const api = await Api('http://127.0.0.1:16044/rest/v1', 'john', 'LetMeIn', webcrypto as any, fetch)

    const { publicKey, privateKey } = await api.cryptoApi.RSA.generateKeyPair()
    hcpPubKey = ua2hex(await api.cryptoApi.RSA.exportKey(publicKey, 'spki'))
    hcpPrivateKey = ua2hex(await api.cryptoApi.RSA.exportKey(privateKey, 'pkcs8'))

    const hcpAuth = await createHealthcareParty(api, hcpLogin, hcpPwd, hcpPubKey)
    hcpId = hcpAuth.dataOwnerId
    hcpPwd = hcpAuth.password
    await checkExistence('127.0.0.1', 15984, `icure-base`, hcpAuth.dataOwnerId)
    await checkExistence('127.0.0.1', 15984, `icure-base`, hcpAuth.userId)
  })

  after(async function () {
    this.timeout(60000)
    await cleanup('test/scratch', process.env.OSS_DOCKER_URL!)
  })

  it('Should be able to create a patient', async () => {
    const api = await Api('http://127.0.0.1:16044/rest/v1', hcpLogin, hcpPwd!, webcrypto as any, fetch)
    api.cryptoApi.RSA.storeKeyPair(hcpId!, {
      publicKey: api.cryptoApi.utils.spkiToJwk(hex2ua(hcpPubKey!)),
      privateKey: api.cryptoApi.utils.pkcs8ToJwk(hex2ua(hcpPrivateKey!)),
    })

    const { publicKey, privateKey } = await api.cryptoApi.RSA.generateKeyPair()
    const publicKeyHex = ua2hex(await api.cryptoApi.RSA.exportKey(publicKey, 'spki'))
    const privateKeyHex = ua2hex(await api.cryptoApi.RSA.exportKey(privateKey, 'pkcs8'))

    const result = await createPatient(api, `${uuid().substring(0, 6)}@icure.com`, uuid(), publicKeyHex, privateKeyHex, fetch)
    await checkExistence('127.0.0.1', 15984, `icure-patient`, result.dataOwnerId)
    await checkExistence('127.0.0.1', 15984, `icure-base`, result.userId)
  })

  it('Should be able to create a device', async () => {
    const api = await Api('http://127.0.0.1:16044/rest/v1', hcpLogin, hcpPwd!, webcrypto as any, fetch)

    const { publicKey } = await api.cryptoApi.RSA.generateKeyPair()
    const publicKeyHex = ua2hex(await api.cryptoApi.RSA.exportKey(publicKey, 'spki'))

    const result = await createDevice(api, `${uuid().substring(0, 6)}@icure.com`, uuid(), publicKeyHex)
    await checkExistence('127.0.0.1', 15984, `icure-base`, result.dataOwnerId)
    await checkExistence('127.0.0.1', 15984, `icure-base`, result.userId)
  })
})
