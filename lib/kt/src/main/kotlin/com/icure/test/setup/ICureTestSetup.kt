package com.icure.test.setup

import io.ktor.client.HttpClient
import io.ktor.client.engine.cio.CIO
import io.ktor.client.request.basicAuth
import io.ktor.client.request.get
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.http.ContentType
import io.ktor.http.URLBuilder
import io.ktor.http.contentType
import kotlinx.coroutines.delay
import java.util.UUID
import java.util.concurrent.TimeUnit

object ICureTestSetup {
    private val httpClient = HttpClient(CIO)

    suspend fun startCouchDbContainer(couchDbUser: String = "icure", couchDbPassword: String = "icure"): String {
        val dockerId = UUID.randomUUID().toString().substring(0, 6)
        val started = execute("/usr/local/bin/docker run " +
                "-p 15984:5984 " +
                "-e COUCHDB_USER=$couchDbUser -e COUCHDB_PASSWORD=$couchDbPassword -e ERL_MAX_PORT=16384 " +
                "-d --name couchdb-test-${dockerId} " +
                "couchdb:3.2.2")

        if (!started) {
            throw RuntimeException("Could not start CouchDB Docker Container within 2 minutes")
        }

        configCouchDb(couchDbUser, couchDbPassword)
        return "couchdb-test-${dockerId}"
    }

    fun cleanContainer(dockerName: String): Boolean {
        val stopped = execute("/usr/local/bin/docker stop $dockerName")
        return if (stopped)
            execute("/usr/local/bin/docker rm $dockerName")
        else
            false
    }

    private fun execute(command: String): Boolean = ProcessBuilder(command.split(' '))
        .start()
        .waitFor(2, TimeUnit.MINUTES)

    private suspend fun configCouchDb(couchDbUser: String = "icure", couchDbPassword: String = "icure") {
        retry(5, 2000) {
            httpClient.post("http://127.0.0.1:15984/_cluster_setup") {
                basicAuth(couchDbUser, couchDbPassword)
                contentType(ContentType.Application.Json)
                setBody("{\n" +
                        "  \"action\" : \"enable_single_node\",\n" +
                        "  \"username\" : \"$couchDbUser\",\n" +
                        "  \"password\" : \"$couchDbPassword\",\n" +
                        "  \"bind_address\" : \"0.0.0.0\",\n" +
                        "  \"port\" : 5984,\n" +
                        "  \"singlenode\" : true\n" +
                        "}")
            }
        }
    }

    private suspend fun <T> retry(maxTimes: Int = 5, delayInMs: Long = 2000, command: suspend () -> T): T {
        return try {
            command.invoke()
        } catch (e: Exception) {
            println("Could not execute operation: ${e.message}")

            if (maxTimes == 0) {
                throw e
            } else {
                delay(delayInMs)
                retry(maxTimes - 1, delayInMs, command)
            }
        }
    }

}
