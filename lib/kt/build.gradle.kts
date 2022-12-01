
plugins {
    kotlin("jvm") version "1.7.20"
}

buildscript {
    repositories {
        mavenCentral()
        maven { url = uri("https://maven.taktik.be/content/groups/public") }
    }
    dependencies {
        classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:1.7.20")
        classpath("com.taktik.gradle:gradle-plugin-git-version:2.0.4")
        classpath("com.taktik.gradle:gradle-plugin-maven-repository:1.0.2")
    }
}

apply(plugin = "git-version")
apply(plugin = "maven-repository")

val gitVersion: String? by project

group = "io.icure"
version = gitVersion ?: "0.0.1-SNAPSHOT"

repositories {
    mavenCentral()
    maven {
        url = uri("https://maven.taktik.be/content/groups/public")
    }
}

dependencies {
    implementation(group = "org.jetbrains.kotlin", name = "kotlin-stdlib-jdk8", version = "1.6.21")
    implementation(group = "org.jetbrains.kotlin", name = "kotlin-reflect", version = "1.6.21")
    implementation(group = "org.jetbrains.kotlinx", name = "kotlinx-coroutines-core", version = "1.6.1")

    implementation(group = "io.ktor", name = "ktor-client-core", version = "2.1.3")
    implementation(group = "io.ktor", name = "ktor-client-cio", version = "2.1.3")

    testImplementation(group = "org.junit.jupiter", name = "junit-jupiter", version = "5.7.0")
    testImplementation(group = "io.mockk", name = "mockk", version = "1.11.0")
    testImplementation(group = "io.kotest", name = "kotest-assertions-core", version = "5.5.4")
    testImplementation(group = "io.kotest", name = "kotest-runner-junit5", version = "5.5.4")
}

java {
    sourceCompatibility = JavaVersion.VERSION_11
    targetCompatibility = JavaVersion.VERSION_11
}

tasks.withType<org.jetbrains.kotlin.gradle.tasks.KotlinCompile> {
    kotlinOptions {
        freeCompilerArgs = listOf("-Xjsr305=strict")
        jvmTarget = "11"
    }
}

tasks.withType<Test>().configureEach {
    useJUnitPlatform()
}
