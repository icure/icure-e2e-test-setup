import * as https from 'https'
import * as fs from 'fs'
import * as path from 'path'
import { exec } from 'child_process'
import * as util from 'util'
import axios from 'axios'

const standardEnv = {
  COUCHDB_PORT: '15984',
  AS_PORT: '16044',
  COUCHDB_USER: 'icure',
  COUCHDB_PASSWORD: 'icure',
  MOCK_ICURE_URL: 'http://kraken-1:16043/rest/v1',
  ICURE_MOCK_LOGIN: 'john',
  ICURE_MOCK_PWD: 'LetMeIn',
  ICURE_TEST_GROUP_ID: 'test-group',
  ...process.env,
}

interface DockerProcess {
  ID?: string
  Name?: string
  Command?: string
  Project?: string
  Service?: string
  State?: string
  Health?: string
  ExitCode?: number
  Publishers: [{ [key: string]: number | string | undefined }]
}

export function sleep(ms: number): Promise<any> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function retry<P>(fn: () => Promise<P>, retryCount = 3, sleepTime = 2000, exponentialFactor = 2): Promise<P> {
  let retry = 0
  const doFn: () => Promise<P> = () => {
    return fn().catch((e) => (retry++ < retryCount ? (sleepTime && sleep((sleepTime *= exponentialFactor)).then(() => doFn())) || doFn() : Promise.reject(e)))
  }
  return doFn()
}

function fullUrl(composeFile: string) {
  return composeFile.startsWith('https') ? composeFile : `https://raw.githubusercontent.com/icure-io/icure-e2e-test-setup/master/${composeFile}.yaml`
}

/**
 * Set up a full environment for the tests. This will download the docker-compose files and start the containers.
 *
 * The docker compose can embed extra files that will be extracted in the scratchDir (see docker-compose-cloud.yaml for an example)
 *
 *
 * @param scratchDir the directory where the docker-compose files will be downloaded
 * @param compose the docker-compose file to use. Can be a full url or a short name (e.g. docker-compose)
 * @param profiles the docker profiles that are going to be applied to the docker-compose file
 */
export const setup = async (scratchDir: string, compose: string, ...profiles: string[]) => {
  const composeFile = await download(scratchDir, fullUrl(compose))

  const composeFileContent = fs.readFileSync(composeFile, 'utf8')
  const dependencies = composeFileContent
    .split(/# => /)
    .slice(1)
    .reduce((files, s) => {
      const lines = s.split(/[\r\n]+# /)
      return { ...files, [lines[0]]: lines.slice(1) }
    }, {} as { [key: string]: string[] })

  Object.keys(dependencies).forEach((file) => {
    const filePath = path.join(scratchDir, file)
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    fs.writeFileSync(filePath, dependencies[file].join('\n'))
  })

  try {
    const { stdout, stderr } = await util.promisify(exec)(`/usr/local/bin/docker compose -f '${composeFile}' ${profiles.map((p) => `--profile ${p}`).join(' ')} up -d`, {
      env: standardEnv,
    })
    console.log(`stdout: ${stdout}`)
    console.error(`stderr: ${stderr}`)
  } catch (e) {
    console.error(e)
  }
}

/**
 * Stop the containers launched by setup and destroy them
 *
 * @param scratchDir the directory where the docker-compose files will be downloaded
 * @param compose the docker-compose file to use. Can be a full url or a short name (e.g. docker-compose)
 * @param profiles the docker profiles that had been applied to the docker-compose file when it was launched by the setup command
 *
 */
export const cleanup = async (scratchDir: string, compose: string, ...profiles: string[]) => {
  try {
    const composeFile = await download(scratchDir, fullUrl(compose))
    const { stdout, stderr } = await util.promisify(exec)(`/usr/local/bin/docker compose -f '${composeFile}' ${profiles.map((p) => `--profile ${p}`).join(' ')} down`, {
      env: standardEnv,
    })
    console.log(`stdout: ${stdout}`)
    console.error(`stderr: ${stderr}`)
  } catch (e) {
    console.error(e)
  }
}

async function download(scratchDir: string, url: string) {
  let fullPath = path.join(scratchDir, path.basename(url))
  const file = fs.createWriteStream(fullPath)
  return new Promise<string>((resolve, reject) => {
    https.get(url, function (response) {
      response.pipe(file)

      // after download completed close filestream
      file.on('finish', () => {
        file.close()
        console.log('Download Completed')
        resolve(fullPath)
      })

      file.on('error', (err) => {
        console.log('Download Failed')
        reject(err)
      })
    })
  })
}

/**
 * Initialise CouchDB and set the admin user and password
 *
 * @param couchDbUrl: the URL of the CouchDB instance to bootstrap
 */
export const setupCouchDb = async (couchDbUrl: string) => {
  await retry(() =>
    axios.post(
      `${couchDbUrl}/_cluster_setup`,
      {
        action: 'enable_single_node',
        username: 'icure',
        password: 'icure',
        bind_address: '0.0.0.0',
        port: 5984,
        singlenode: true,
      },
      {
        auth: { username: 'icure', password: 'icure' },
        headers: {
          'Content-Type': 'application/json',
        },
      },
    ),
  )
}

/**
 * Bootstrap the oss kraken with the minimal environment needed to run the tests
 *
 * @param userId The user id of the user that will be created
 * @param login The login of the user that will be created
 * @param passwordHash The password hash of the user that will be created (AES-256 encoded)
 * @param couchDbUrl: the URL of the CouchDB instance to bootstrap
 */
export const bootstrapOssKraken = async (
  userId: string,
  login = 'john',
  passwordHash = '1796980233375ccd113c972d946b2c4a7892e4f69c60684cfa730150047f9c0b', //LetMeIn
  couchDbUrl = 'http://127.0.0.1:15984',
) => {
  await retry(() => axios.get(`${couchDbUrl}/icure-base`, { auth: { username: 'icure', password: 'icure' } }), 5)

  await retry(() =>
    axios
      .post(
        `${couchDbUrl}/icure-base`,
        {
          _id: userId,
          login: login,
          passwordHash: passwordHash,
          type: 'database',
          status: 'ACTIVE',
          java_type: 'org.taktik.icure.entities.User',
        },
        {
          auth: { username: 'icure', password: 'icure' },
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )
      .catch((e) => {
        if (e.response.status !== 409) {
          throw e
        }
      }),
  )
}

/**
 * Bootstrap the kraken with the minimal environment needed to run the tests, create other apps, users or databases.
 *
 * @param userId The user id of the user that will be created
 * @param login The login of the user that will be created
 * @param passwordHash The password hash of the user that will be created (AES-256 encoded)
 * @param groupId The group id of the master group that will be created
 * @param groupPassword The password of the master group that will be created
 * @param couchDbUrl: the URL of the CouchDB instance to bootstrap
 */
export const bootstrapCloudKraken = async (
  userId: string,
  login = 'john',
  passwordHash = '1796980233375ccd113c972d946b2c4a7892e4f69c60684cfa730150047f9c0b', //LetMeIn
  groupId = 'xx',
  groupPassword = 'xx', // pragma: allowlist secret
  couchDbUrl = 'http://127.0.0.1:15984',
) => {
  await retry(() => axios.get(`${couchDbUrl}/icure-__-base`, { auth: { username: 'icure', password: 'icure' } }), 5)

  await axios
    .put(
      `${couchDbUrl}/icure-${groupId}-base`,
      {},
      {
        auth: { username: 'icure', password: 'icure' },
        headers: {
          'Content-Type': 'application/json',
        },
      },
    )
    .catch(() => {
      /* DB might already exist */
    })

  await axios
    .post(
      `${couchDbUrl}/icure-${groupId}-base`,
      {
        _id: userId,
        login: login,
        passwordHash: passwordHash,
        isUse2fa: true,
        type: 'database',
        status: 'ACTIVE',
        java_type: 'org.taktik.icure.entities.User',
      },
      {
        auth: { username: 'icure', password: 'icure' },
        headers: {
          'Content-Type': 'application/json',
        },
      },
    )
    .catch((e) => {
      if (e.response.status !== 409) {
        throw e
      }
    })

  await retry(() =>
    axios
      .post(
        `${couchDbUrl}/icure-__-base`,
        {
          _id: `${groupId}:${userId}`,
          login: login,
          passwordHash: passwordHash, //LetMeIn
          type: 'database',
          status: 'ACTIVE',
          groupId: groupId,
          permissions: [
            {
              grants: [
                {
                  java_type: 'org.taktik.icure.entities.security.AlwaysPermissionItem',
                  type: 'ADMIN',
                },
              ],
            },
          ],
          java_type: 'org.taktik.icure.entities.User',
        },
        {
          auth: { username: 'icure', password: 'icure' },
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )
      .catch((e) => {
        if (e.response.status !== 409) {
          throw e
        }
      }),
  )

  await axios
    .post(
      `${couchDbUrl}/_users`,
      {
        _id: `org.couchdb.user:${groupId}`,
        name: groupId,
        roles: [],
        type: 'user',
        password: groupPassword,
      },
      {
        auth: { username: 'icure', password: 'icure' },
        headers: {
          'Content-Type': 'application/json',
        },
      },
    )
    .catch((e) => {
      if (e.response.status !== 409) {
        throw e
      }
    })
  await retry(() =>
    axios
      .post(
        `${couchDbUrl}/icure-__-config`,
        {
          _id: groupId,
          java_type: 'org.taktik.icure.entities.Group',
          name: groupId,
          password: groupPassword, //pragma: allowlist secret
          properties: [
            {
              type: {
                identifier: 'com.icure.dbs.quota.0',
                type: 'INTEGER',
              },
              typedValue: {
                type: 'INTEGER',
                integerValue: 1000,
              },
            },
            {
              type: {
                identifier: 'com.icure.dbs.quota.1',
                type: 'INTEGER',
              },
              typedValue: {
                type: 'INTEGER',
                integerValue: 2,
              },
            },
            {
              type: {
                identifier: 'com.icure.dbs.quota.2',
                type: 'INTEGER',
              },
              typedValue: {
                type: 'INTEGER',
                integerValue: 5,
              },
            },
          ],
          tags: [
            {
              id: 'IC-GROUP|root|1.0',
              type: 'IC-GROUP',
              code: 'root',
              version: '1.0',
            },
          ],
          rev_history: {},
          servers: [],
        },
        {
          auth: { username: 'icure', password: 'icure' },
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )
      .catch((e) => {
        if (e.response.status !== 409) {
          throw e
        }
      }),
  )
}

/**
 * This function checks if all the docker containers in a docker compose are up and running
 *
 * @param scratchDir the directory where the docker compose file is
 * @param compose the docker compose filename or URL
 */
export async function checkIfDockerIsOnline(scratchDir: string, compose: string): Promise<boolean> {
  try {
    const composeFile = path.join(scratchDir, path.basename(fullUrl(compose)))
    const { stdout } = await util.promisify(exec)(`/usr/local/bin/docker compose -f '${composeFile}' ps --format json`, { env: standardEnv })
    const containers = JSON.parse(stdout) as DockerProcess[]
    return !!containers && containers.length > 0 && containers.every((element) => !!element.State && element.State === 'running')
  } catch (e) {
    return false
  }
}
