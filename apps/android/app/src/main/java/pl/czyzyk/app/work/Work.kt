package pl.czyzyk.app.work

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import pl.czyzyk.app.photos.PhotoWorker
import pl.czyzyk.app.update.UpdateWorker
import java.util.concurrent.TimeUnit

object Work {
    private val network = Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()

    // APPEND_OR_REPLACE: a send already running finishes, and new messages get a follow-up run.
    fun enqueueSend(context: Context, policy: ExistingWorkPolicy = ExistingWorkPolicy.APPEND_OR_REPLACE) {
        val request = OneTimeWorkRequestBuilder<SendWorker>()
            .setConstraints(network)
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
            .build()
        WorkManager.getInstance(context).enqueueUniqueWork("send", policy, request)
    }

    fun enqueueSync(context: Context, policy: ExistingWorkPolicy = ExistingWorkPolicy.KEEP) {
        val request = OneTimeWorkRequestBuilder<SyncWorker>()
            .setConstraints(network)
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
            .build()
        WorkManager.getInstance(context).enqueueUniqueWork("sync", policy, request)
    }

    /**
     * "Odśwież teraz": runs the sync and the send right away. REPLACE drops a run waiting in
     * backoff (up to 5 hours after a long server outage), which KEEP and APPEND would wait for.
     */
    fun refreshNow(context: Context) {
        enqueueSync(context, ExistingWorkPolicy.REPLACE)
        enqueueSend(context, ExistingWorkPolicy.REPLACE)
    }

    /**
     * Photo check (document-import). After a photo notification it waits for WhatsApp to
     * download the file; a later notification moves the run later (REPLACE), a sweep keeps a
     * waiting run (KEEP).
     */
    fun enqueuePhotos(context: Context, delaySeconds: Long = 0) {
        val request = OneTimeWorkRequestBuilder<PhotoWorker>()
            .setConstraints(network)
            .setInitialDelay(delaySeconds, TimeUnit.SECONDS)
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 60, TimeUnit.SECONDS)
            .build()
        val policy = if (delaySeconds > 0) ExistingWorkPolicy.REPLACE else ExistingWorkPolicy.KEEP
        WorkManager.getInstance(context).enqueueUniqueWork("photos", policy, request)
    }

    /** Tracked groups are refreshed every [SyncInterval] chosen on the phone (group-tracking). */
    fun schedulePeriodicSync(context: Context) {
        val minutes = Deps.state(context).syncInterval.minutes
        val request = PeriodicWorkRequestBuilder<SyncWorker>(minutes, TimeUnit.MINUTES).setConstraints(network).build()
        // UPDATE keeps the existing work but applies a changed interval.
        WorkManager.getInstance(context)
            .enqueueUniquePeriodicWork(PERIODIC_SYNC, ExistingPeriodicWorkPolicy.UPDATE, request)
    }

    /** Daily look for a newer release (app-updates); KEEP leaves an existing schedule alone. */
    fun scheduleUpdateCheck(context: Context) {
        val request = PeriodicWorkRequestBuilder<UpdateWorker>(24, TimeUnit.HOURS)
            .setConstraints(network)
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.MINUTES)
            .build()
        WorkManager.getInstance(context)
            .enqueueUniquePeriodicWork(PERIODIC_UPDATE, ExistingPeriodicWorkPolicy.KEEP, request)
    }

    const val PERIODIC_SYNC = "sync-periodic"
    const val PERIODIC_UPDATE = "update-periodic"
}
