package pl.czyzyk.app.work

import android.content.Context
import pl.czyzyk.app.net.SendResult

/** How draining the outbox ended. */
enum class DrainResult { EMPTY, RETRY, UNAUTHORIZED, NOT_PAIRED }

/**
 * Drains the outbox (notification-capture): a message leaves the queue only when the server
 * accepted it (or rejected it for good). Used by SendWorker and, right after a capture, by the
 * notification listener itself – WorkManager jobs wait for Doze maintenance windows while the
 * screen is off, the listener does not. One drain at a time per process.
 */
object Outbox {
    private const val BATCH = 50
    private val lock = Any()

    fun drain(context: Context): DrainResult = synchronized(lock) { drainLocked(context) }

    private fun drainLocked(context: Context): DrainResult {
        val store = Deps.store(context)
        val pairing = store.pairing ?: return DrainResult.NOT_PAIRED
        val queue = Deps.queue(context)
        val state = Deps.state(context)
        val api = Deps.api()
        while (true) {
            val batch = queue.oldest(BATCH)
            if (batch.isEmpty()) return DrainResult.EMPTY
            for (item in batch) {
                when (val result = api.sendNotification(pairing, item.message)) {
                    SendResult.Delivered -> {
                        queue.remove(item.rowId)
                        state.lastDeliveredAt = System.currentTimeMillis()
                    }
                    is SendResult.Rejected -> queue.remove(item.rowId)
                    SendResult.Unauthorized -> {
                        store.markRevoked()
                        return DrainResult.UNAUTHORIZED
                    }
                    is SendResult.Retry -> {
                        queue.markAttempt(item.rowId)
                        return DrainResult.RETRY
                    }
                }
            }
        }
    }
}
