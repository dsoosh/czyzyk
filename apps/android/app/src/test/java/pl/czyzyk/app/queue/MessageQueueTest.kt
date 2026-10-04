package pl.czyzyk.app.queue

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import pl.czyzyk.app.capture.CapturedMessage

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class MessageQueueTest {
    private val context = ApplicationProvider.getApplicationContext<Context>()
    private fun message(key: String) = CapturedMessage("com.whatsapp", "Motylki", "Pani Ania", "W piątek bal", 1000, true, key)

    @Test
    fun survivesReopeningTheDatabaseLikeAProcessRestart() {
        MessageQueue(context, "restart.db").apply {
            enqueue(message("k1"))
            close()
        }
        val reopened = MessageQueue(context, "restart.db")
        val item = reopened.oldest(10).single()
        assertEquals(message("k1"), item.message)
        reopened.close()
    }

    @Test
    fun storesEachIdempotencyKeyOnce() {
        val queue = MessageQueue(context, "dedupe.db")
        assertTrue(queue.enqueue(message("k1")))
        assertFalse(queue.enqueue(message("k1")))
        assertEquals(1, queue.size())
        queue.remove(queue.oldest(1).single().rowId)
        assertEquals(0, queue.size())
    }
}
