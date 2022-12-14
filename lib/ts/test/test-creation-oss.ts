import 'isomorphic-fetch'
import uuid = require('uuid')
import { setup, bootstrapOssKraken, setupCouchDb, cleanup } from '../src'
import { Api, hex2ua, pkcs8ToJwk, spkiToJwk } from '@icure/api'
import { createDeviceUser, createHealthcarePartyUser, createPatientUser } from '../src/creation'
import { checkExistence, checkPatientExistence, checkUserExistence, generateKeysAsString, setLocalStorage } from './utils'
import { webcrypto } from 'crypto'

setLocalStorage(fetch)

const dockerComposeUrl = 'https://raw.githubusercontent.com/icure/icure-e2e-test-setup/arm64/docker-compose.yaml'
const hcpLogin = `${uuid()}@icure.com`
let hcpPwd = uuid()
let hcpPrivateKey: string | undefined
let hcpPubKey: string | undefined
let hcpId: string | undefined

describe('Test creation with OSS', function () {
  before(async function () {
    this.timeout(300000)
    await setup('test/scratch', dockerComposeUrl)
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
    await cleanup('test/scratch', dockerComposeUrl)
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

    const result = await createPatientUser(api, `${uuid()}@icure.com`, uuid(), publicKeyHex, privateKeyHex, fetch)
    await checkExistence('127.0.0.1', 15984, `icure-patient`, result.dataOwnerId)
    await checkUserExistence('http://127.0.0.1:16044/rest/v1', result)
    await checkPatientExistence('http://127.0.0.1:16044/rest/v1', result)
  }).timeout(60000)

  it('Should be able to create a device', async () => {
    const api = await Api('http://127.0.0.1:16044/rest/v1', hcpLogin, hcpPwd!, webcrypto as any, fetch)

    const result = await createDeviceUser(api, `${uuid()}@icure.com`, uuid())
    await checkExistence('127.0.0.1', 15984, `icure-base`, result.dataOwnerId)
    await checkUserExistence('http://127.0.0.1:16044/rest/v1', result)
  }).timeout(60000)
})
