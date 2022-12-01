package com.icure.test.setup

import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.engine.cio.CIO
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.request.basicAuth
import io.ktor.client.request.get
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpStatusCode
import io.ktor.http.URLBuilder
import io.ktor.http.contentType
import io.ktor.http.isSuccess
import io.ktor.serialization.kotlinx.json.json
import io.ktor.utils.io.errors.IOException
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.retry
import java.util.UUID
import java.util.concurrent.TimeUnit
import kotlin.time.Duration.Companion.minutes
import kotlin.time.Duration.Companion.seconds

object ICureTestSetup {
    private val httpClient = HttpClient(CIO) {
        install(ContentNegotiation) {
            json()
        }
    }


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
            .collect()

        isClusterSetup(couchDbUser, couchDbPassword).collect {
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

    private fun execute(command: String): Boolean = ProcessBuilder(command.split(' '))
        .start()
        .waitFor(2, TimeUnit.MINUTES)

    private suspend fun configCouchDb(couchDbUser: String = "icure", couchDbPassword: String = "icure"): Flow<Unit> = flow<Unit> {
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
    }.retry(5) {
        delay(2.seconds)
        println("Could not execute operation: ${it.message}")
        true
    }

    private suspend fun isClusterSetup(couchDbUser: String = "icure", couchDbPassword: String = "icure") = flow<ClusterSetupStatus> {
        val response = httpClient.get("http://127.0.0.1:15984/_cluster_setup") {
            basicAuth(couchDbUser, couchDbPassword)
            contentType(ContentType.Application.Json)
        }

        if (response.status.isSuccess()) {
            val status = response.body<ClusterSetupStatus>()
            if (status.state != "cluster_finished" && status.state != "single_node_enabled") {
                throw RuntimeException("Cluster not setup yet: ${status.state}")
            }
        } else {
            throw RuntimeException("Cluster not setup: Error ${response.status} - ${response.bodyAsText()}")
        }

    }.retry(5) {
        delay(5.seconds)
        println("Error during ClusterSetup Status check: ${it.message}")
        true
    }.map {
        it.state != "cluster_finished" && it.state != "single_node_enabled"
    }

    @kotlinx.serialization.Serializable
    data class ClusterSetupStatus(val state: String)
}
