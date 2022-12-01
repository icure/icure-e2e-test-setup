package com.icure.test.setup

import com.icure.test.setup.CouchDbRestClient.configureCouchDbClusterSetup
import com.icure.test.setup.CouchDbRestClient.createNewDatabaseForGroup
import com.icure.test.setup.CouchDbRestClient.createNewDbUser
import com.icure.test.setup.CouchDbRestClient.createNewGroupInConfig
import com.icure.test.setup.CouchDbRestClient.createNewUserIn
import com.icure.test.setup.CouchDbRestClient.createNewUserInBase
import com.icure.test.setup.CouchDbRestClient.isClusterSetup
import kotlinx.coroutines.flow.collect
import java.util.UUID
import java.util.concurrent.TimeUnit

object ICureTestSetup {
    suspend fun startCouchDbContainer(localPort: String = "15984", couchDbUser: String = "icure", couchDbPassword: String = "icure"): String {
        val dockerId = UUID.randomUUID().toString().substring(0, 6)
        val started = execute("/usr/local/bin/docker run " +
                "-p $localPort:5984 " +
                "-e COUCHDB_USER=$couchDbUser -e COUCHDB_PASSWORD=$couchDbPassword -e ERL_MAX_PORT=16384 " +
                "-d --name couchdb-test-${dockerId} " +
                "couchdb:3.2.2")

        if (!started) {
            throw RuntimeException("Could not start CouchDB Docker Container within 2 minutes")
        }

        configureCouchDbClusterSetup("http://127.0.0.1:$localPort", couchDbUser, couchDbPassword).collect()

        isClusterSetup("http://127.0.0.1:$localPort", couchDbUser, couchDbPassword).collect {
            if (!it) {
                throw RuntimeException("Could not finalize CouchDB Cluster Setup")
            }

            println("CouchDB Cluster Setup successfully initialized")
        }

        return "couchdb-test-${dockerId}"
    }

    fun cleanContainer(dockerName: String): Boolean {
        val stopped = execute("/usr/local/bin/docker stop $dockerName")
        return if (stopped)
            execute("/usr/local/bin/docker rm $dockerName")
        else
            false
    }

    suspend fun bootstrapOss(userId: String = UUID.randomUUID().toString(),
                             userLogin: String = "john",
                             userPasswordHash: String = "1796980233375ccd113c972d946b2c4a7892e4f69c60684cfa730150047f9c0b",
                             couchDbUrl: String = "http://127.0.0.1:15984",
                             couchDbUser: String = "icure",
                             couchDbPassword: String = "icure") {
        createNewUserInBase(null, userId, userLogin, userPasswordHash, couchDbUrl, couchDbUser, couchDbPassword)
    }

    suspend fun bootstrapCloud(groupId: String = "xx",
                               groupPassword: String = "xx",
                               groupUserId: String = UUID.randomUUID().toString(),
                               groupUserLogin: String = "john",
                               groupUserPasswordHash: String = "1796980233375ccd113c972d946b2c4a7892e4f69c60684cfa730150047f9c0b",
                               couchDbUrl: String = "http://127.0.0.1:15984",
                               couchDbUser: String = "icure",
                               couchDbPassword: String = "icure") {
        createNewDatabaseForGroup(groupId, couchDbUrl, couchDbUser, couchDbPassword)
        createNewUserIn(groupId, groupUserId, groupUserLogin, groupUserPasswordHash, couchDbUrl, couchDbUser, couchDbPassword)
        createNewUserInBase(groupId, groupUserId, groupUserLogin, groupUserPasswordHash, couchDbUrl, couchDbUser, couchDbPassword)
        createNewDbUser(groupId, groupPassword, couchDbUrl, couchDbUser, couchDbPassword)
        createNewGroupInConfig(groupId, groupPassword, couchDbUrl, couchDbUser, couchDbPassword)
    }

    private fun execute(command: String): Boolean = ProcessBuilder(command.split(' '))
        .start()
        .waitFor(2, TimeUnit.MINUTES)
}
