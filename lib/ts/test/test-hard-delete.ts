import 'isomorphic-fetch'
import uuid = require('uuid')
import { before } from 'mocha'
import { Api } from '@icure/api'
import { webcrypto } from 'crypto'
import { createHealthcarePartyUser, createMasterHcpUser, createPatientUser, UserCredentials } from '../src/creation'
import { generateKeysAsString, setLocalStorage } from './utils'
import { expect } from 'chai'
import { createGroup } from '../src/groups'
import axios from 'axios'

setLocalStorage(fetch)

const iCureUrl = process.env.ICURE_TEST_URL!

describe('Test group creation and hard delete', function () {
  it('Should be able to create a group and hard delete it', async () => {
    const groupId = uuid()
    const api = await Api(iCureUrl, 'john', 'LetMeIn', webcrypto as any, fetch)

    await createGroup(api, groupId)

    const masterCredentials = await createMasterHcpUser('john', 'LetMeIn', groupId, fetch, iCureUrl)
    // const groupId = "1e8c4c18-d534-4ad0-8fb1-f7a8ded9fa04"

    const result = await axios.delete(`${iCureUrl}/group/hard/${groupId}`, {
      auth: { username: 'john', password: 'LetMeIn' },
      headers: {
        'Content-Type': 'application/json',
      },
    })

    console.log(result)
  }).timeout(120000)
})
