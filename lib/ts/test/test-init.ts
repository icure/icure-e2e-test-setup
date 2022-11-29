import { bootstrapOssKraken, setup, bootstrapCloudKraken, cleanup, setupCouchDb, checkIfDockerIsOnline } from '../src'
import { checkCouchDbStarted, checkExistence } from './utils'
import uuid = require('uuid')
import { expect } from 'chai'

describe('Test initialization', () => {
  it('Should be able to initialize the OSS Kraken', async () => {
    await setup('test/scratch', 'docker-compose')
    await checkCouchDbStarted()
    await setupCouchDb('http://127.0.0.1:15984')
    const userId = uuid()
    await bootstrapOssKraken(userId)
    await checkExistence('127.0.0.1', 15984, 'icure-base', userId)
    await cleanup('test/scratch', 'docker-compose')
  }).timeout(60000)

  it('Should be able to initialize the Kraken', async () => {
    await setup('test/scratch', 'docker-compose-cloud')
    await checkCouchDbStarted()
    await setupCouchDb('http://127.0.0.1:15984')
    const userId = uuid()
    const groupId = 'xx'
    await bootstrapCloudKraken(userId)
    await checkExistence('127.0.0.1', 15984, 'icure-xx-base', userId)
    await checkExistence('127.0.0.1', 15984, 'icure-__-base', `${groupId}:${userId}`)
    await checkExistence('127.0.0.1', 15984, '_users', `org.couchdb.user:${groupId}`)
    await checkExistence('127.0.0.1', 15984, 'icure-__-config', groupId)
    await cleanup('test/scratch', 'docker-compose-cloud')
  }).timeout(60000)

  it('Should be able to check if a docker compose is running', async () => {
    await setup('test/scratch', 'docker-compose')
    await checkCouchDbStarted()
    await setupCouchDb('http://127.0.0.1:15984')
    const userId = uuid()
    await bootstrapOssKraken(userId)
    const isUp = await checkIfDockerIsOnline('test/scratch', 'docker-compose')
    expect(isUp).to.eq(true)
    await cleanup('test/scratch', 'docker-compose')
  }).timeout(60000)

  it('Should be able to check if a docker compose is not running', async () => {
    await setup('test/scratch', 'docker-compose')
    await checkCouchDbStarted()
    await setupCouchDb('http://127.0.0.1:15984')
    await cleanup('test/scratch', 'docker-compose')
    const isUp = await checkIfDockerIsOnline('test/scratch', 'docker-compose')
    expect(isUp).to.eq(false)
  }).timeout(60000)
})
