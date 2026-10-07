package pl.czyzyk.app.update

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import androidx.work.ListenableWorker
import androidx.work.testing.TestListenableWorkerBuilder
import kotlinx.coroutines.test.runTest
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import okio.Buffer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import pl.czyzyk.app.AppState
import pl.czyzyk.app.work.Deps
import java.io.File
import java.security.MessageDigest

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class UpdatesTest {
    private val context = ApplicationProvider.getApplicationContext<Context>()
    private val server = MockWebServer()
    private lateinit var state: AppState
    private lateinit var dir: File
    private lateinit var updater: Updater

    private val apk = "fake apk bytes".repeat(1000).toByteArray()
    private val sha = MessageDigest.getInstance("SHA-256").digest(apk).joinToString("") { "%02x".format(it) }

    private fun manifest(code: Long = 1042, sha256: String = sha, size: Long = apk.size.toLong(), tag: String = "android-v$code") =
        """{"versionCode":$code,"versionName":"1.42","tag":"$tag","sha256":"$sha256","size":$size}"""

    private fun enqueue(manifest: String, apkBody: ByteArray? = apk) {
        server.enqueue(MockResponse().setBody(manifest))
        apkBody?.let { server.enqueue(MockResponse().setBody(Buffer().write(it))) }
    }

    @Before
    fun setUp() {
        server.start()
        state = AppState(context.getSharedPreferences("test_update_state", Context.MODE_PRIVATE))
        dir = File(context.filesDir, "test-updates").apply { deleteRecursively() }
        updater = Updater(ReleaseSource(server.url("/dsoosh/czyzyk").toString().trimEnd('/')))
    }

    @After
    fun tearDown() {
        server.shutdown()
        context.getSharedPreferences("test_update_state", Context.MODE_PRIVATE).edit().clear().commit()
        dir.deleteRecursively()
    }

    @Test
    fun parsesAndValidatesTheReleaseDescription() {
        assertEquals(UpdateInfo(1042, "1.42", "android-v1042", sha, apk.size.toLong()), UpdateInfo.parse(manifest()))
        assertNull(UpdateInfo.parse(manifest(tag = "../../evil")))
        assertNull(UpdateInfo.parse(manifest(sha256 = "abc")))
        assertNull(UpdateInfo.parse(manifest(size = UpdateInfo.MAX_APK_BYTES + 1)))
        assertNull(UpdateInfo.parse("not json"))
        assertNull(UpdateInfo.parse("""{"versionCode":5}"""))
    }

    @Test
    fun downloadsAndVerifiesANewerRelease() {
        enqueue(manifest())
        val outcome = Updates.prepare(state, updater, dir, currentVersion = 1, now = 1000)
        assertTrue(outcome is Updates.Outcome.Ready)
        val ready = outcome as Updates.Outcome.Ready
        assertEquals(1042L, ready.update.versionCode)
        assertTrue(apk.contentEquals(ready.apk.readBytes()))
        assertEquals("/dsoosh/czyzyk/releases/latest/download/version.json", server.takeRequest().path)
        assertEquals("/dsoosh/czyzyk/releases/download/android-v1042/czyzyk-connect.apk", server.takeRequest().path)
        assertEquals(ready.update, state.readyUpdate)
        assertEquals(1000L, state.lastUpdateCheckAt)
        assertTrue(Updates.verify(ready, state, dir))
    }

    @Test
    fun doesNotDownloadAgainWhenTheUpdateIsAlreadyReady() {
        enqueue(manifest())
        Updates.prepare(state, updater, dir, currentVersion = 1)
        enqueue(manifest(), apkBody = null)
        assertTrue(Updates.prepare(state, updater, dir, currentVersion = 1) is Updates.Outcome.Ready)
        assertEquals(3, server.requestCount)
    }

    @Test
    fun rejectsAFileWithAWrongChecksum() {
        enqueue(manifest(sha256 = "0".repeat(64)))
        assertTrue(Updates.prepare(state, updater, dir, currentVersion = 1) is Updates.Outcome.Failed)
        assertNull(state.readyUpdate)
        assertEquals(0, dir.listFiles().orEmpty().size)
    }

    @Test
    fun rejectsAFileLargerThanAnnounced() {
        enqueue(manifest(size = 10))
        assertTrue(Updates.prepare(state, updater, dir, currentVersion = 1) is Updates.Outcome.Failed)
        assertEquals(0, dir.listFiles().orEmpty().size)
    }

    @Test
    fun upToDateClearsAnOldDownload() {
        enqueue(manifest())
        Updates.prepare(state, updater, dir, currentVersion = 1)
        // The update got installed: the app now runs version 1042.
        enqueue(manifest(), apkBody = null)
        assertEquals(Updates.Outcome.UpToDate, Updates.prepare(state, updater, dir, currentVersion = 1042))
        assertNull(state.readyUpdate)
        assertEquals(0, dir.listFiles().orEmpty().size)
        assertNull(Updates.ready(state, dir, currentVersion = 1042))
    }

    @Test
    fun noReleaseYetIsUnavailable() {
        server.enqueue(MockResponse().setResponseCode(404))
        assertEquals(Updates.Outcome.Unavailable, Updates.prepare(state, updater, dir, currentVersion = 1, now = 5))
        assertEquals(0L, state.lastUpdateCheckAt)
    }

    @Test
    fun aTamperedFileFailsVerificationBeforeInstall() {
        enqueue(manifest())
        val ready = Updates.prepare(state, updater, dir, currentVersion = 1) as Updates.Outcome.Ready
        ready.apk.appendText("x")
        assertFalse(Updates.verify(ready, state, dir))
        assertNull(state.readyUpdate)
        assertFalse(ready.apk.exists())
    }

    @Test
    fun checksOnOpenAtMostEverySixHours() {
        state.lastUpdateCheckAt = 0
        assertTrue(Updates.shouldCheckOnOpen(state, now = Updates.CHECK_ON_OPEN_MILLIS))
        state.lastUpdateCheckAt = 1
        assertFalse(Updates.shouldCheckOnOpen(state, now = Updates.CHECK_ON_OPEN_MILLIS))
    }

    @Test
    fun workerInstallsInTheBackgroundWhenAllowed() = runTest {
        val installed = mutableListOf<File>()
        Deps.state = { state }
        Deps.updatesEnabled = { true }
        Deps.versionCode = { 1 }
        Deps.updater = { updater }
        Deps.canInstallSilently = { true }
        Deps.install = { _, file, interactive -> if (!interactive) installed += file }
        enqueue(manifest())
        val result = TestListenableWorkerBuilder<UpdateWorker>(context).build().doWork()
        assertEquals(ListenableWorker.Result.success(), result)
        assertEquals(1, installed.size)
        assertNotNull(state.readyUpdate)
        File(context.filesDir, "updates").deleteRecursively()
    }

    @Test
    fun debugBuildsDoNotCheck() = runTest {
        Deps.updatesEnabled = { false }
        val result = TestListenableWorkerBuilder<UpdateWorker>(context).build().doWork()
        assertEquals(ListenableWorker.Result.success(), result)
        assertEquals(0, server.requestCount)
    }
}
