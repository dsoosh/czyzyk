package pl.czyzyk.app.work

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters

/**
 * Drains the outbox (see [Outbox]): network problems and 429/5xx keep the messages and retry
 * with exponential backoff; 401 marks the device as disconnected and stops.
 */
class SendWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result = when (Outbox.drain(applicationContext)) {
        DrainResult.EMPTY -> Result.success()
        DrainResult.RETRY -> Result.retry()
        DrainResult.UNAUTHORIZED, DrainResult.NOT_PAIRED -> Result.failure()
    }
}
