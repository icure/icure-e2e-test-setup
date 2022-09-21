import { afterEach, describe } from 'mocha'
import { cleanup, retry, setup } from '../src'
import axios from 'axios'
import { expect } from 'chai'
import { checkCouchDbStarted } from './utils';

async function checkMsgGwStarted() {
  await retry(async () => {
    const {
      data: { status: msgGwStatus },
      status,
    } = await axios.get('http://127.0.0.1:8080/actuator/health')
    expect(status).to.equal(200)
    expect(msgGwStatus).to.equal('UP')
  })
}

async function checkMsgGwNotStarted() {
  await retry(async () => {
    const {
      data: { status: msgGwStatus },
      status,
    } = await axios.get('http://127.0.0.1:8080/actuator/health').catch(() => ({ status: 0, data: { status: 'DOWN' } }))
    expect(status).to.equal(0)
    expect(msgGwStatus).to.equal('DOWN')
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
  it('should use profiles to select the launched containers', async () => {
    await setup('test/scratch', 'docker-compose', 'mock')
    await checkCouchDbStarted()
    await checkMsgGwStarted()
    await cleanup('test/scratch', 'docker-compose', 'mock')
    await setup('test/scratch', 'docker-compose')
    await checkMsgGwNotStarted()
  })
  it('should start the a complex set of docker containers dependent on embedded files', async () => {
    await setup('test/scratch1', 'docker-compose-cloud')
    await checkCouchDbStarted()
  })

})
