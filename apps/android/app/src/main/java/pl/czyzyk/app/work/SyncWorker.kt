package pl.czyzyk.app.work

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import pl.czyzyk.app.capture.ListenerWatchdog
import pl.czyzyk.app.net.SendResult
import pl.czyzyk.app.net.UnauthorizedException

/** Refreshes the tracked-group list (TTL 15 min) and reports newly seen group names. */
class SyncWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        // The periodic sync also checks that Android still delivers notifications to the reader.
        ListenerWatchdog.ensureBound(applicationContext)
        val store = Deps.store(applicationContext)
        val pairing = store.pairing ?: return Result.success()
        val state = Deps.state(applicationContext)
        val api = Deps.api()

        val config = try {
            api.fetchConfig(pairing)
        } catch (e: UnauthorizedException) {
            store.markRevoked()
            return Result.failure()
        } ?: return Result.retry()
        state.saveTrackedGroups(config.trackedGroups, config.ttlSeconds * 1000)

        val pending = state.pendingGroupReports
        if (pending.isNotEmpty()) {
            when (api.reportGroups(pairing, pending)) {
                SendResult.Delivered, is SendResult.Rejected -> state.markGroupsReported(pending)
                SendResult.Unauthorized -> {
                    store.markRevoked()
                    return Result.failure()
                }
                is SendResult.Retry -> return Result.retry()
            }
        }
        // Sweep for photos whose notification-triggered check did not run (process death, no network).
        if (state.photosEnabled) Work.enqueuePhotos(applicationContext)
        return Result.success()
    }
}
