package pl.czyzyk.app.work

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import pl.czyzyk.app.net.SendResult

/**
 * Drains the outbox. A message leaves the queue only when the server accepted it
 * (or rejected it for good); network problems and 429/5xx keep it and retry with
 * exponential backoff; 401 marks the device as disconnected and stops.
 */
class SendWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        val store = Deps.store(applicationContext)
        val pairing = store.pairing ?: return Result.failure()
        val queue = Deps.queue(applicationContext)
        val state = Deps.state(applicationContext)
        val api = Deps.api()

        while (true) {
            val batch = queue.oldest(BATCH)
            if (batch.isEmpty()) return Result.success()
            for (item in batch) {
                when (val result = api.sendNotification(pairing, item.message)) {
                    SendResult.Delivered -> {
                        queue.remove(item.rowId)
                        state.lastDeliveredAt = System.currentTimeMillis()
                    }
                    is SendResult.Rejected -> queue.remove(item.rowId)
                    SendResult.Unauthorized -> {
                        store.markRevoked()
                        return Result.failure()
                    }
                    is SendResult.Retry -> {
                        queue.markAttempt(item.rowId)
                        return Result.retry()
                    }
                }
            }
        }
    }

    companion object {
        private const val BATCH = 50
    }
}
