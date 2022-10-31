import { retry } from '../src'
import axios from 'axios'
import { expect } from 'chai'
import { UserCredentials } from '../src/creation'
import { Api, Apis, hex2ua, KeyStorageImpl, LocalStorageImpl, pkcs8ToJwk, spkiToJwk, ua2hex } from '@icure/api'
import { webcrypto } from 'crypto'
import { tmpdir } from 'os'
import { TextDecoder, TextEncoder } from 'util'
import 'isomorphic-fetch'

export function setLocalStorage(fetch: (input: RequestInfo, init?: RequestInit) => Promise<Response>) {
  ;(global as any).localStorage = new (require('node-localstorage').LocalStorage)(tmpdir(), 5 * 1024 ** 3)
  ;(global as any).fetch = fetch
  ;(global as any).Storage = ''
  ;(global as any).TextDecoder = TextDecoder
  ;(global as any).TextEncoder = TextEncoder
}

export async function generateKeysAsString(api: Apis): Promise<{ publicKeyHex: string; privateKeyHex: string }> {
  const { publicKey, privateKey } = await api.cryptoApi.RSA.generateKeyPair()
  const publicKeyHex = ua2hex(await api.cryptoApi.RSA.exportKey(publicKey, 'spki'))
  const privateKeyHex = ua2hex(await api.cryptoApi.RSA.exportKey(privateKey, 'pkcs8'))
  return { publicKeyHex, privateKeyHex }
}

export async function checkCouchDbStarted() {
  await retry(async () => {
    const {
      data: { couchdb },
      status,
    } = await axios.get('http://127.0.0.1:15984')
    expect(status).to.equal(200)
    expect(couchdb).to.equal('Welcome')
  })
}

export async function checkExistence(host: string, port: number, db: string, objectId = '') {
  await retry(async () => {
    const { status: status } = await axios.get(`http://${host}:${port}/${db}/${objectId}`, {
      auth: { username: 'icure', password: 'icure' },
      headers: {
        'Content-Type': 'application/json',
      },
    })
    expect(status).to.equal(200)
  })
}

export async function checkUserExistence(host: string, credentials: UserCredentials) {
  const newApi = await Api(host, credentials.login, credentials.password, webcrypto as any, fetch)
  const user = await newApi.userApi.getCurrentUser()
  expect(!!user).to.eq(true)
  expect(user.login).to.eq(credentials.login)
}

export async function checkPatientExistence(host: string, credentials: UserCredentials) {
  const newApi = await Api(host, credentials.login, credentials.password, webcrypto as any, fetch)
  const jwk = {
    publicKey: spkiToJwk(hex2ua(credentials.publicKey)),
    privateKey: pkcs8ToJwk(hex2ua(credentials.privateKey)),
  }
  await newApi.cryptoApi.cacheKeyPair(jwk)
  await newApi.cryptoApi.keyStorage.storeKeyPair(`${credentials.dataOwnerId}.${credentials.publicKey.slice(-32)}`, jwk)
  const user = await newApi.userApi.getCurrentUser()
  const patient = await newApi.patientApi.getPatientWithUser(user, credentials.dataOwnerId)
  expect(!!patient).to.eq(true)
  expect(patient.id).to.eq(credentials.dataOwnerId)
}

export async function checkAbsence(host: string, port: number, db: string, objectId = '') {
  axios
    .get(`http://${host}:${port}/${db}/${objectId}`, {
      auth: { username: 'icure', password: 'icure' },
      headers: {
        'Content-Type': 'application/json',
      },
    })
    .catch((error) => {
      expect(error.response.status).to.eq(404)
    })
}
