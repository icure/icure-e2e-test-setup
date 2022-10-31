import 'isomorphic-fetch'
import { setup, bootstrapCloudKraken, cleanup, setupCouchDb } from '../src'
import { checkAbsence, checkCouchDbStarted, checkExistence } from './utils'
import uuid = require('uuid')
import { expect } from 'chai'
import { before } from 'mocha'
import { createGroup, hardDeleteGroup, softDeleteGroup } from '../src/groups'
import { Api, Apis } from '@icure/api'
import { webcrypto } from 'crypto'

async function createGroupAndCheckForSuccess(): Promise<{ api: Apis; groupId: string }> {
  const api = await Api('http://127.0.0.1:16044/rest/v1', 'john', 'LetMeIn', webcrypto as any, fetch)
  const group = await createGroup(api, uuid())
  await checkExistence('127.0.0.1', 15984, `icure-${group.id!}-healthdata`)
  await checkExistence('127.0.0.1', 15984, `icure-${group.id!}-patient`)
  await checkExistence('127.0.0.1', 15984, `icure-${group.id!}-base`)
  return { api, groupId: group.id! }
}

describe('Test groups', function () {
  before(async function () {
    this.timeout(60000)
    await setup('test/scratch', process.env.KRAKEN_DOCKER_URL!)
    await checkCouchDbStarted()
    await setupCouchDb('http://127.0.0.1:15984')
    const userId = uuid()
    await bootstrapCloudKraken(userId)
  })

  after(async function () {
    this.timeout(60000)
    await cleanup('test/scratch', process.env.KRAKEN_DOCKER_URL!)
  })

  it('Should be able to create a group and soft delete it', async () => {
    const { api, groupId } = await createGroupAndCheckForSuccess()
    const deletedGroup = await softDeleteGroup(api, groupId)
    expect(!!deletedGroup.deletionDate).to.eq(true)
  })

  it('Should be able to create a group and hard delete it', async () => {
    const { api, groupId } = await createGroupAndCheckForSuccess()
    await hardDeleteGroup(api, groupId)
    await checkAbsence('127.0.0.1', 15984, `icure-${groupId}-healthdata`)
    await checkAbsence('127.0.0.1', 15984, `icure-${groupId}-patient`)
    await checkAbsence('127.0.0.1', 15984, `icure-${groupId}-base`)
  })
})
