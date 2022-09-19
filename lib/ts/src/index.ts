import * as https from 'https'
import * as fs from 'fs'
import * as path from 'path'
import { exec } from 'child_process'
import * as util from 'util'
import axios from 'axios';
import internal from 'stream';

const standardEnv = {
  COUCHDB_PORT: '15984',
  AS_PORT: '16044',
  COUCHDB_USER: 'icure',
  COUCHDB_PASSWORD: 'icure',
  ...process.env,
}


export const retry = (fn: () => Promise<any>, retriesLeft = 10, interval = 2000): Promise<any> => {
  return fn().catch((err) => {
    if (retriesLeft > 0) {
      console.log('Retrying in ' + interval + 'ms', err)
      return new Promise((resolve) =>
        setTimeout(() => resolve(retry(fn, retriesLeft - 1, interval * 2)), interval)
      ).then(() => fn())
    }
  })
}


function fullUrl(composeFile: string) {
  return composeFile.startsWith('https') ? composeFile : `https://raw.githubusercontent.com/icure-io/icure-e2e-test-setup/master/${composeFile}.yaml`
}

/**
 * Setup a full environment for the tests. This will download the docker-compose files and start the containers.
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
  const dependencies = composeFileContent.split(/# => /).slice(1).reduce((files, s) => {
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
    const { stdout, stderr } = await util.promisify(exec)(`/usr/local/bin/docker compose -f '${composeFile}' ${profiles.map((p) => `--profile ${p}`).join(' ')} down`, { env: standardEnv })
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
 */
export const setupCouchDb = async (host: string, port: number) => {
  await retry(() =>
    axios.post(
      `http://${host}:${port}/_cluster_setup`,
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
      }
    )
  )
}


/**
 * Bootstrap the oss kraken with the minimal environment needed to run the tests
 *
 * @param userId The user id of the user that will be created
 * @param login The login of the user that will be created
 * @param passwordHash The password hash of the user that will be created (AES-256 encoded)
 */
export const bootstrapOssKraken = async (
  userId: string,
  login = 'john',
  passwordHash = '1796980233375ccd113c972d946b2c4a7892e4f69c60684cfa730150047f9c0b', //LetMeIn
) => {
  await axios
    .post(
      'http://127.0.0.1:15984/icure-base',
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
      }
    )
    .catch((e) => {
      if (e.response.status !== 409) {
        throw e
      }
    })
};

/**
 * Bootstrap the kraken with the minimal environment needed to run the tests, create other apps, users or databases.
 *
 * @param userId The user id of the user that will be created
 * @param login The login of the user that will be created
 * @param passwordHash The password hash of the user that will be created (AES-256 encoded)
 * @param groupId The group id of the master group that will be created
 * @param groupPassword The password of the master group that will be created
 */
export const bootstrapCloudKraken = async (
  userId: string,
  login = 'john',
  passwordHash = '1796980233375ccd113c972d946b2c4a7892e4f69c60684cfa730150047f9c0b', //LetMeIn
  groupId = 'xx',
  groupPassword = 'xx', // pragma: allowlist secret
  couchDbUrl = '127.0.0.1',
  couchDbPort = 15984
) => {
  await axios
    .put(
      `http://${couchDbUrl}:${couchDbPort}/icure-xx-base`,
      {},
      {
        auth: { username: 'icure', password: 'icure' },
        headers: {
          'Content-Type': 'application/json',
        },
      }
    )
    .catch(() => {
      /* DB might already exist */
    })

  await axios
    .post(
      `http://${couchDbUrl}:${couchDbPort}/icure-xx-base`,
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
      }
    )
    .catch((e) => {
      if (e.response.status !== 409) {
        throw e
      }
    })

  await retry(() =>
    axios
      .post(
        `http://${couchDbUrl}:${couchDbPort}/icure-__-base`,
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
                  java_type:
                    'org.taktik.icure.entities.security.AlwaysPermissionItem',
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
        }
      )
      .catch((e) => {
        if (e.response.status !== 409) {
          throw e
        }
      })
  )

  await axios
    .post(
      `http://${couchDbUrl}:${couchDbPort}/_users`,
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
      }
    )
    .catch((e) => {
      if (e.response.status !== 409) {
        throw e
      }
    })
  await retry(() =>
    axios
      .post(
        `http://${couchDbUrl}:${couchDbPort}/icure-__-config`,
        {
          _id: groupId,
          java_type: 'org.taktik.icure.entities.Group',
          name: groupId,
          password: groupPassword, //pragma: allowlist secret
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
        }
      )
      .catch((e) => {
        if (e.response.status !== 409) {
          throw e
        }
      })
  )
};
