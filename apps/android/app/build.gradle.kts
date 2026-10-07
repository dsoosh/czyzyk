plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
}

/** Release signing and version come from CI (android-release.yml); local and PR builds run without them. */
fun env(name: String): String? = System.getenv(name)?.takeIf { it.isNotBlank() }

android {
    namespace = "pl.czyzyk.app"
    compileSdk = 36

    defaultConfig {
        // Separate from the PWA installed from the browser, which is also called "Czyżyk".
        applicationId = "pl.czyzyk.connect"
        minSdk = 26
        targetSdk = 36
        versionCode = env("CZYZYK_VERSION_CODE")?.toInt() ?: 1
        versionName = env("CZYZYK_VERSION_NAME") ?: "0.1.0-dev"
        // GitHub repository whose releases the app updates itself from.
        buildConfigField("String", "UPDATE_REPO", "\"${providers.gradleProperty("czyzyk.updateRepo").getOrElse("dsoosh/czyzyk")}\"")
    }

    signingConfigs {
        env("CZYZYK_KEYSTORE_FILE")?.let { keystore ->
            create("release") {
                storeFile = file(keystore)
                storePassword = env("CZYZYK_KEYSTORE_PASSWORD")
                keyAlias = env("CZYZYK_KEY_ALIAS")
                keyPassword = env("CZYZYK_KEY_PASSWORD")
            }
        }
    }

    buildTypes {
        debug {
            // Debug builds are signed with a per-machine key, so they cannot update in place.
            buildConfigField("boolean", "UPDATES_ENABLED", "false")
        }
        release {
            isMinifyEnabled = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            signingConfig = signingConfigs.findByName("release")
            buildConfigField("boolean", "UPDATES_ENABLED", "true")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    testOptions {
        unitTests.isIncludeAndroidResources = true
    }
}

kotlin {
    jvmToolchain(17)
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.activity.compose)
    // The code scanner pulls an old fragment; ActivityResult APIs need fragment >= 1.3 (lintVitalRelease).
    implementation(libs.androidx.fragment)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.androidx.work.runtime)
    implementation(libs.androidx.security.crypto)
    implementation(libs.play.services.code.scanner)
    implementation(libs.okhttp)
    implementation(libs.kotlinx.coroutines.android)
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.compose.ui.tooling.preview)
    debugImplementation(libs.androidx.compose.ui.tooling)

    testImplementation(libs.junit)
    testImplementation(libs.robolectric)
    testImplementation(libs.androidx.test.core)
    testImplementation(libs.androidx.work.testing)
    testImplementation(libs.okhttp.mockwebserver)
    testImplementation(libs.kotlinx.coroutines.test)
}
