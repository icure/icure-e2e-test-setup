import { afterEach, describe } from 'mocha'
import { cleanup, setup } from '../src'
import axios from 'axios'
import { expect } from 'chai'

const retry = (fn: () => Promise<any>, retriesLeft = 5, interval = 1000): Promise<any> => {
  return fn().catch((err) => {
    console.log('Retrying in ' + interval + 'ms', err)
    return new Promise((resolve) => setTimeout(() => resolve(retry(fn, retriesLeft - 1, interval * 2)), interval)).then(() => fn())
  })
}

async function checkCouchDbStarted() {
  await retry(async () => {
    const {
      data: { couchdb },
      status,
    } = await axios.get('http://127.0.0.1:15984')
    expect(status).to.equal(200)
    expect(couchdb).to.equal('Welcome')
  })
}

async function checkMsgGwStarted() {
  await retry(async () => {
    const {
      data: { pong },
      status,
    } = await axios.get('http://127.0.0.1:8080/ping')
    expect(status).to.equal(200)
    expect(pong).to.match(/1\d+/)
  })
}

describe('Test setup', () => {
  afterEach(() => cleanup('test/scratch', 'docker-compose'))

  it('should start the docker with long urls', async () => {
    await setup('test/scratch', 'https://raw.githubusercontent.com/icure-io/icure-e2e-test-setup/master/docker-compose.yaml')
    await checkCouchDbStarted()
  })
  it('should start the docker with short urls', async () => {
    await setup('test/scratch', 'docker-compose')
    await checkCouchDbStarted()
  })
  it('profiles let you control the launched containers', async () => {
    await setup('test/scratch', 'docker-compose', 'msg-gw')
    await checkCouchDbStarted()
    await checkMsgGwStarted()
  })
})
