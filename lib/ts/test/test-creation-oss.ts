import 'isomorphic-fetch'
import uuid = require('uuid')
import { setup, bootstrapOssKraken, setupCouchDb, cleanup, waitUntilKrakenStarted } from '../src'
import { Api, hex2ua, pkcs8ToJwk, spkiToJwk } from '@icure/api'
import { createDeviceUser, createHealthcarePartyUser, createPatientUser } from '../src/creation'
import { checkExistence, checkPatientExistence, checkUserExistence, generateKeysAsString, setLocalStorage } from './utils'
import { webcrypto } from 'crypto'

setLocalStorage(fetch)

const hcpLogin = `${uuid().substring(0, 6)}@icure.com`
let hcpPwd = uuid()
let hcpPrivateKey: string | undefined
let hcpPubKey: string | undefined
let hcpId: string | undefined

describe('Test creation with OSS', function () {
  before(async function () {
    this.timeout(300000)
    await setup('test/scratch', process.env.OSS_DOCKER_URL!)
    await waitUntilKrakenStarted('http://127.0.0.1:16044')
    await setupCouchDb('http://127.0.0.1:15984')
    const userId = uuid()
    await bootstrapOssKraken(userId)
    const api = await Api('http://127.0.0.1:16044/rest/v1', 'john', 'LetMeIn', webcrypto as any, fetch)

    const { publicKeyHex: hcpPubKeyTmp, privateKeyHex: hcpPrivateKeyTmp } = await generateKeysAsString(api)
    hcpPubKey = hcpPubKeyTmp
    hcpPrivateKey = hcpPrivateKeyTmp

    const hcpAuth = await createHealthcarePartyUser(api, hcpLogin, hcpPwd, hcpPubKey, hcpPrivateKey)
    hcpId = hcpAuth.dataOwnerId
    hcpPwd = hcpAuth.password
    await checkExistence('127.0.0.1', 15984, `icure-base`, hcpAuth.dataOwnerId)
    await checkUserExistence('http://127.0.0.1:16044/rest/v1', hcpAuth)
  })

  after(async function () {
    this.timeout(60000)
    await cleanup('test/scratch', process.env.OSS_DOCKER_URL!)
  })

  it('Should be able to create a patient', async () => {
    const api = await Api('http://127.0.0.1:16044/rest/v1', hcpLogin, hcpPwd!, webcrypto as any, fetch)

    const jwk = {
      publicKey: spkiToJwk(hex2ua(hcpPubKey!)),
      privateKey: pkcs8ToJwk(hex2ua(hcpPrivateKey!)),
    }
    await api.cryptoApi.cacheKeyPair(jwk)
    await api.cryptoApi.keyStorage.storeKeyPair(`${hcpId!}.${hcpPubKey!.slice(-32)}`, jwk)

    const { publicKeyHex, privateKeyHex } = await generateKeysAsString(api)

    const result = await createPatientUser(api, `${uuid().substring(0, 6)}@icure.com`, uuid(), publicKeyHex, privateKeyHex, fetch)
    await checkExistence('127.0.0.1', 15984, `icure-patient`, result.dataOwnerId)
    await checkUserExistence('http://127.0.0.1:16044/rest/v1', result)
    await checkPatientExistence('http://127.0.0.1:16044/rest/v1', result)
  })

  it('Should be able to create a device', async () => {
    const api = await Api('http://127.0.0.1:16044/rest/v1', hcpLogin, hcpPwd!, webcrypto as any, fetch)

    const { publicKeyHex } = await generateKeysAsString(api)

    const result = await createDeviceUser(api, `${uuid().substring(0, 6)}@icure.com`, uuid(), publicKeyHex)
    await checkExistence('127.0.0.1', 15984, `icure-base`, result.dataOwnerId)
    await checkUserExistence('http://127.0.0.1:16044/rest/v1', result)
  })
})
