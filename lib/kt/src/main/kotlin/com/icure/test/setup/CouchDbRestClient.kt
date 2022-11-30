package com.icure.test.setup

import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.engine.cio.CIO
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.request.basicAuth
import io.ktor.client.request.get
import io.ktor.client.request.post
import io.ktor.client.request.put
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType
import io.ktor.http.isSuccess
import io.ktor.serialization.kotlinx.json.json
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.retry
import kotlin.time.Duration.Companion.seconds

object CouchDbRestClient {
    private val httpClient = HttpClient(CIO) {
        install(ContentNegotiation) {
            json()
        }
    }

    suspend fun configureCouchDbClusterSetup(couchDBUrl: String = "http://127.0.0.1:15984",
                                             couchDbUser: String = "icure",
                                             couchDbPassword: String = "icure"): Flow<Unit> = flow<Unit> {
        httpClient.post("$couchDBUrl/_cluster_setup") {
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

    suspend fun isClusterSetup(couchDBUrl: String = "http://127.0.0.1:15984",
                               couchDbUser: String = "icure",
                               couchDbPassword: String = "icure") = flow<ClusterSetupStatus> {
        val response = httpClient.get("$couchDBUrl/_cluster_setup") {
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

    suspend fun createNewDatabase(
        databaseName: String,
        couchDBUrl: String = "http://127.0.0.1:15984",
        couchDbUser: String = "icure",
        couchDbPassword: String = "icure"
    ) {
        val response = httpClient.put("$couchDBUrl/$databaseName") {
            basicAuth(couchDbUser, couchDbPassword)
            contentType(ContentType.Application.Json)
            setBody("{}")
        }

        if (!response.status.isSuccess()) {
            println("Could not create database $databaseName: ${response.status} - ${response.bodyAsText()}")
        }
    }

    suspend fun createNewDatabaseForGroup(
        groupId: String,
        couchDBUrl: String = "http://127.0.0.1:15984",
        couchDbUser: String = "icure",
        couchDbPassword: String = "icure"
    ) = createNewDatabase("icure-$groupId-base", couchDBUrl, couchDbUser, couchDbPassword)

    suspend fun createNewUserIn(
        groupId: String,
        groupUserId: String,
        groupUserLogin: String,
        groupUserPasswordHash: String,
        couchDBUrl: String = "http://127.0.0.1:15984",
        couchDbUser: String = "icure",
        couchDbPassword: String = "icure"
    ) {
        val response = httpClient.post("$couchDBUrl/icure-$groupId-base") {
            basicAuth(couchDbUser, couchDbPassword)
            contentType(ContentType.Application.Json)
            setBody("{" +
                    "  \"_id\" : \"$groupUserId\", " +
                    "  \"login\" : \"$groupUserLogin\", " +
                    "  \"passwordHash\" : \"$groupUserPasswordHash\", " +
                    "  \"isUse2fa\" : true, " +
                    "  \"type\" : \"database\", " +
                    "  \"status\" : \"ACTIVE\", " +
                    "  \"java_type\" : \"org.taktik.icure.entities.User\" " +
                    "}")
        }

        if (!response.status.isSuccess() && response.status != HttpStatusCode.Conflict) {
            throw RuntimeException("Could not create a new DB User in icure-$groupId-base")
        }
    }

    suspend fun createNewUserInBase(
        groupId: String? = null,
        groupUserId: String,
        groupUserLogin: String,
        groupUserPasswordHash: String,
        couchDBUrl: String = "http://127.0.0.1:15984",
        couchDbUser: String = "icure",
        couchDbPassword: String = "icure"
    ) {
        val userId = if (groupId == null) groupUserId else "$groupId:$groupUserId"

        val response = httpClient.post("$couchDBUrl/icure-${if (groupId == null) "" else "__-"}base") {
            basicAuth(couchDbUser, couchDbPassword)
            contentType(ContentType.Application.Json)
            setBody("{\n" +
                    "  \"_id\" : \"$userId\",\n" +
                    "  \"login\" : \"$groupUserLogin\",\n" +
                    "  \"passwordHash\" : \"$groupUserPasswordHash\",\n" +
                    "  \"type\" : \"database\",\n" +
                    "  \"status\" : \"ACTIVE\",\n" +
                    (if (groupId != null)
                        "\"groupId\" : \"$groupId\",\n" +
                                "  \"permissions\": [\n" +
                                "            {\n" +
                                "              \"grants\": [\n" +
                                "                {\n" +
                                "                  \"java_type\": \"org.taktik.icure.entities.security.AlwaysPermissionItem\",\n" +
                                "                  \"type\": \"ADMIN\"\n" +
                                "                }\n" +
                                "              ]\n" +
                                "            }\n" +
                                "          ],\n"
                    else "") +
                    "  \"java_type\" : \"org.taktik.icure.entities.User\"" +
                    "}")
        }

        if (!response.status.isSuccess() && response.status != HttpStatusCode.Conflict) {
            throw RuntimeException("Could not create DB User $groupId:$groupUserId in icure-__-base")
        }
    }

    suspend fun createNewDbUser(
        groupId: String,
        groupPassword: String,
        couchDBUrl: String = "http://127.0.0.1:15984",
        couchDbUser: String = "icure",
        couchDbPassword: String = "icure"
    ) {
        val response = httpClient.post("$couchDBUrl/_users") {
            basicAuth(couchDbUser, couchDbPassword)
            contentType(ContentType.Application.Json)
            setBody("{\n" +
                    "  \"_id\" : \"org.couchdb.user:$groupId\",\n" +
                    "  \"name\" : \"$groupId\",\n" +
                    "  \"password\" : \"$groupPassword\",\n" +
                    "  \"roles\" : [],\n" +
                    "  \"type\" : \"user\"\n" +
                    "}")
        }

        if (!response.status.isSuccess() && response.status != HttpStatusCode.Conflict) {
            throw RuntimeException("Could not create a new DB User in _users")
        }
    }

    suspend fun createNewGroupInConfig(
        groupId: String,
        groupPassword: String,
        couchDBUrl: String = "http://127.0.0.1:15984",
        couchDbUser: String = "icure",
        couchDbPassword: String = "icure"
    ) {
        val response = httpClient.post("$couchDBUrl/icure-__-config") {
            basicAuth(couchDbUser, couchDbPassword)
            contentType(ContentType.Application.Json)
            setBody("{\n" +
                    "          \"_id\": \"$groupId\",\n" +
                    "          \"java_type\": \"org.taktik.icure.entities.Group\",\n" +
                    "          \"name\": \"$groupId\",\n" +
                    "          \"password\": \"$groupPassword\",\n" +
                    "          \"properties\": [\n" +
                    "            {\n" +
                    "              \"type\": {\n" +
                    "                \"identifier\": \"com.icure.dbs.quota.0\",\n" +
                    "                \"type\": \"INTEGER\"\n" +
                    "              },\n" +
                    "              \"typedValue\": {\n" +
                    "                \"type\": \"INTEGER\",\n" +
                    "                \"integerValue\": 1000\n" +
                    "              }\n" +
                    "            },\n" +
                    "            {\n" +
                    "              \"type\": {\n" +
                    "                \"identifier\": \"com.icure.dbs.quota.1\",\n" +
                    "                \"type\": \"INTEGER\"\n" +
                    "              },\n" +
                    "              \"typedValue\": {\n" +
                    "                \"type\": \"INTEGER\",\n" +
                    "                \"integerValue\": 2\n" +
                    "              }\n" +
                    "            },\n" +
                    "            {\n" +
                    "              \"type\": {\n" +
                    "                \"identifier\": \"com.icure.dbs.quota.2\",\n" +
                    "                \"type\": \"INTEGER\"\n" +
                    "              },\n" +
                    "              \"typedValue\": {\n" +
                    "                \"type\": \"INTEGER\",\n" +
                    "                \"integerValue\": 5\n" +
                    "              }\n" +
                    "            }\n" +
                    "          ],\n" +
                    "          \"tags\": [\n" +
                    "            {\n" +
                    "              \"id\": \"IC-GROUP|root|1.0\",\n" +
                    "              \"type\": \"IC-GROUP\",\n" +
                    "              \"code\": \"root\",\n" +
                    "              \"version\": \"1.0\"\n" +
                    "            }\n" +
                    "          ],\n" +
                    "          \"rev_history\": {},\n" +
                    "          \"servers\": []\n" +
                    "        }")
        }

        if (!response.status.isSuccess() && response.status != HttpStatusCode.Conflict) {
            throw RuntimeException("Could not create a new groupDB  in _config")
        }
    }

    @kotlinx.serialization.Serializable
    data class ClusterSetupStatus(val state: String)

}
