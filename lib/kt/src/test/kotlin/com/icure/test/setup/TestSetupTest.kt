package com.icure.test.setup

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import io.kotest.matchers.string.shouldNotContain
import io.ktor.client.HttpClient
import io.ktor.client.engine.cio.CIO
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.request.basicAuth
import io.ktor.client.request.get
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.contentType
import io.ktor.http.isSuccess
import io.ktor.serialization.kotlinx.json.json
import java.util.UUID

internal class TestSetupTest: StringSpec({
    val httpClient = HttpClient(CIO) {
        install(ContentNegotiation) {
            json()
        }
    }

    "Start Docker CouchDB Successfully" {
        val dockerContainer = ICureTestSetup.startCouchDbContainer()
        dockerContainer shouldContain "couchdb-test-"

        val cleaned = ICureTestSetup.cleanContainer(dockerContainer)
        cleaned shouldBe true
    }

    "Start Docker CouchDB Successfully With other credentials" {
        val dockerContainer = ICureTestSetup.startCouchDbContainer("15985", "test", "test")
        dockerContainer shouldContain "couchdb-test-"

        val cleaned = ICureTestSetup.cleanContainer(dockerContainer)
        cleaned shouldBe true
    }

    "Init a Kraken environment Successfully" {
        val dockerContainer = ICureTestSetup.startCouchDbContainer()
        CouchDbRestClient.createNewDatabase("icure-__-base", couchDbUser = "icure", couchDbPassword = "icure")
        CouchDbRestClient.createNewDatabase("icure-__-config", couchDbUser = "icure", couchDbPassword = "icure")

        val userId = UUID.randomUUID().toString()

        // When
        ICureTestSetup.bootstrapCloud("xx", "xx", userId, "john")

        // Then
        checkDatabaseExists(httpClient, "xx", "icure", "icure")
        checkUserExistsInGroup(httpClient, "xx", userId, "john", "icure", "icure")
        checkUserExistsInBase(httpClient, "xx:$userId", "john", "icure", "icure")

        // Finally
        ICureTestSetup.cleanContainer(dockerContainer)
    }

    "Init a OSS environment Successfully" {
        val dockerContainer = ICureTestSetup.startCouchDbContainer()
        CouchDbRestClient.createNewDatabase("icure-base", couchDbUser = "icure", couchDbPassword = "icure")

        val userId = UUID.randomUUID().toString()

        // When
        ICureTestSetup.bootstrapOss(userId, "john")

        // Then
        checkUserExistsInBase(httpClient, userId, "john", couchDbUser = "icure", couchDbPassword ="icure")

        // Finally
        ICureTestSetup.cleanContainer(dockerContainer)
    }
})

private suspend fun checkDatabaseExists(httpClient: HttpClient, groupId: String, couchDbUser: String, couchDbPassword: String) {
    val response = httpClient.get("http://127.0.0.1:15984/icure-$groupId-base") {
        basicAuth(couchDbUser, couchDbPassword)
        contentType(ContentType.Application.Json)
    }

    response.status.isSuccess() shouldBe true
}

private suspend fun checkUserExistsInGroup(httpClient: HttpClient,
                                    groupId: String,
                                    userId: String,
                                    userLogin: String,
                                    couchDbUser: String,
                                    couchDbPassword: String) {
    val response = httpClient.get("http://127.0.0.1:15984/icure-$groupId-base/$userId") {
        basicAuth(couchDbUser, couchDbPassword)
        contentType(ContentType.Application.Json)
    }
    response.status.isSuccess() shouldBe true

    val responseBody = response.bodyAsText()
    responseBody shouldContain userId
    responseBody shouldContain userLogin
    responseBody shouldContain "\"isUse2fa\":true"
    responseBody shouldContain "\"type\":\"database\""
    responseBody shouldContain "\"status\":\"ACTIVE\""
    responseBody shouldContain "\"java_type\":\"org.taktik.icure.entities.User\""
}

private suspend fun checkUserExistsInBase(httpClient: HttpClient,
                                           userId: String,
                                           userLogin: String,
                                           couchDbUser: String,
                                           couchDbPassword: String) {
    val baseDatabaseName = if (userId.contains(':')) "icure-__-base" else "icure-base"
    val response = httpClient.get("http://127.0.0.1:15984/$baseDatabaseName/$userId") {
        basicAuth(couchDbUser, couchDbPassword)
        contentType(ContentType.Application.Json)
    }
    response.status.isSuccess() shouldBe true

    val responseBody = response.bodyAsText()
    responseBody shouldContain userId
    responseBody shouldContain userLogin
    responseBody shouldContain "\"type\":\"database\""
    responseBody shouldContain "\"status\":\"ACTIVE\""
    responseBody shouldContain "\"java_type\":\"org.taktik.icure.entities.User\""

    if (userId.contains(':')) { // We are in the Cloud context
        responseBody shouldContain "org.taktik.icure.entities.security.AlwaysPermissionItem"
    } else {
        responseBody shouldNotContain "org.taktik.icure.entities.security.AlwaysPermissionItem"
    }
}
