package com.icure.test.setup

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain

internal class TestSetupTest: StringSpec({
    "Start Docker CouchDB Successfully" {
        val dockerContainer = ICureTestSetup.startCouchDbContainer()
        dockerContainer shouldContain "couchdb-test-"

        val cleaned = ICureTestSetup.cleanContainer(dockerContainer)
        cleaned shouldBe true
    }

    "Start Docker CouchDB Successfully With other credentials" {
        val dockerContainer = ICureTestSetup.startCouchDbContainer("test", "test")
        dockerContainer shouldContain "couchdb-test-"

        val cleaned = ICureTestSetup.cleanContainer(dockerContainer)
        cleaned shouldBe true
    }
})
