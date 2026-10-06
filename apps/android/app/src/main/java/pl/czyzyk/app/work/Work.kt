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
import java.util.concurrent.TimeUnit

object Work {
    private val network = Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()

    fun enqueueSend(context: Context) {
        val request = OneTimeWorkRequestBuilder<SendWorker>()
            .setConstraints(network)
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
            .build()
        // APPEND_OR_REPLACE: a send already running finishes, and new messages get a follow-up run.
        WorkManager.getInstance(context).enqueueUniqueWork("send", ExistingWorkPolicy.APPEND_OR_REPLACE, request)
    }

    fun enqueueSync(context: Context) {
        val request = OneTimeWorkRequestBuilder<SyncWorker>()
            .setConstraints(network)
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
            .build()
        WorkManager.getInstance(context).enqueueUniqueWork("sync", ExistingWorkPolicy.KEEP, request)
    }

    /** Tracked groups are refreshed every [SyncInterval] chosen on the phone (group-tracking). */
    fun schedulePeriodicSync(context: Context) {
        val minutes = Deps.state(context).syncInterval.minutes
        val request = PeriodicWorkRequestBuilder<SyncWorker>(minutes, TimeUnit.MINUTES).setConstraints(network).build()
        // UPDATE keeps the existing work but applies a changed interval.
        WorkManager.getInstance(context)
            .enqueueUniquePeriodicWork(PERIODIC_SYNC, ExistingPeriodicWorkPolicy.UPDATE, request)
    }

    const val PERIODIC_SYNC = "sync-periodic"
}
