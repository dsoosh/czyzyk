package pl.czyzyk.app.work

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import androidx.work.ListenableWorker
import androidx.work.testing.TestListenableWorkerBuilder
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import pl.czyzyk.app.AppState
import pl.czyzyk.app.capture.CapturedMessage
import pl.czyzyk.app.net.IngestApi
import pl.czyzyk.app.net.IngestConfig
import pl.czyzyk.app.net.SendResult
import pl.czyzyk.app.net.UnauthorizedException
import pl.czyzyk.app.pairing.Pairing
import pl.czyzyk.app.pairing.SecureStore
import pl.czyzyk.app.queue.MessageQueue

/** Server double: answers each upload with the next scripted result. */
private class FakeApi(var results: MutableList<SendResult> = mutableListOf()) : IngestApi {
    val sent = mutableListOf<CapturedMessage>()
    var config: IngestConfig? = IngestConfig(setOf("Motylki"), 900)
    var configUnauthorized = false
    val reported = mutableListOf<Collection<String>>()

    override fun sendNotification(pairing: Pairing, message: CapturedMessage): SendResult {
        sent += message
        return if (results.isEmpty()) SendResult.Delivered else results.removeAt(0)
    }

    override fun fetchConfig(pairing: Pairing): IngestConfig? {
        if (configUnauthorized) throw UnauthorizedException()
        return config
    }

    override fun sendDocument(pairing: Pairing, document: pl.czyzyk.app.photos.PendingDocument, imageBase64: String?): SendResult =
        SendResult.Delivered

    override fun reportGroups(pairing: Pairing, names: Collection<String>): SendResult {
        reported += names
        return SendResult.Delivered
    }
}

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class WorkersTest {
    private val context = ApplicationProvider.getApplicationContext<Context>()
    private lateinit var api: FakeApi
    private lateinit var queue: MessageQueue
    private lateinit var store: SecureStore
    private lateinit var state: AppState

    @Before
    fun setUp() {
        api = FakeApi()
        queue = MessageQueue(context, null) // in-memory
        store = SecureStore(context.getSharedPreferences("test_secure", Context.MODE_PRIVATE)).apply {
            pair(Pairing("https://api.example", "ab".repeat(32)))
        }
        state = AppState(context.getSharedPreferences("test_state", Context.MODE_PRIVATE))
        Deps.api = { api }
        Deps.queue = { queue }
        Deps.store = { store }
        Deps.state = { state }
    }

    @After
    fun tearDown() {
        queue.close()
        context.getSharedPreferences("test_secure", Context.MODE_PRIVATE).edit().clear().commit()
        context.getSharedPreferences("test_state", Context.MODE_PRIVATE).edit().clear().commit()
    }

    private fun message(key: String) = CapturedMessage("com.whatsapp", "Motylki", "Pani Ania", "W piątek bal", 1000, false, key)
    private suspend fun runSend() = TestListenableWorkerBuilder<SendWorker>(context).build().doWork()
    private suspend fun runSync() = TestListenableWorkerBuilder<SyncWorker>(context).build().doWork()

    @Test
    fun deliveredMessagesLeaveTheQueue() = runTest {
        queue.enqueue(message("k1"))
        queue.enqueue(message("k2"))
        assertEquals(ListenableWorker.Result.success(), runSend())
        assertEquals(0, queue.size())
        assertEquals(2, api.sent.size)
    }

    @Test
    fun networkErrorKeepsTheMessageAndRetries() = runTest {
        queue.enqueue(message("k1"))
        api.results = mutableListOf(SendResult.Retry("UnknownHostException"))
        assertEquals(ListenableWorker.Result.retry(), runSend())
        assertEquals(1, queue.size())
        assertEquals(1, queue.oldest(1).single().attempts)

        // Connection back: the same message (same idempotency key) is delivered.
        assertEquals(ListenableWorker.Result.success(), runSend())
        assertEquals(0, queue.size())
        assertEquals(listOf("k1", "k1"), api.sent.map { it.idempotencyKey })
    }

    @Test
    fun rateLimitRetriesLater() = runTest {
        queue.enqueue(message("k1"))
        api.results = mutableListOf(SendResult.Retry("http 429"))
        assertEquals(ListenableWorker.Result.retry(), runSend())
        assertEquals(1, queue.size())
    }

    @Test
    fun rejectedMessagesAreDropped() = runTest {
        queue.enqueue(message("k1"))
        api.results = mutableListOf(SendResult.Rejected(422))
        assertEquals(ListenableWorker.Result.success(), runSend())
        assertEquals(0, queue.size())
    }

    @Test
    fun unauthorizedDisconnectsTheDeviceAndKeepsTheQueue() = runTest {
        queue.enqueue(message("k1"))
        api.results = mutableListOf(SendResult.Unauthorized)
        assertEquals(ListenableWorker.Result.failure(), runSend())
        assertEquals(SecureStore.State.REVOKED, store.state)
        assertNull(store.pairing)
        assertEquals(1, queue.size())
    }

    @Test
    fun syncStoresTrackedGroupsAndReportsNewNames() = runTest {
        state.addPendingGroupReport("Sąsiedzi")
        assertEquals(ListenableWorker.Result.success(), runSync())
        assertEquals(setOf("Motylki"), state.trackedGroups)
        assertEquals(listOf(listOf("Sąsiedzi")), api.reported.map { it.toList() })
        assertEquals(emptySet<String>(), state.pendingGroupReports)
        assertEquals(setOf("Sąsiedzi"), state.knownGroups)
    }

    @Test
    fun syncWithRevokedTokenDisconnects() = runTest {
        api.configUnauthorized = true
        assertEquals(ListenableWorker.Result.failure(), runSync())
        assertEquals(SecureStore.State.REVOKED, store.state)
    }
}
