package pl.czyzyk.app.update

import android.content.Context
import android.util.Log
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import pl.czyzyk.app.work.Deps

/** Daily: fetches a newer release and installs it in the background when Android allows it. */
class UpdateWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        if (!Deps.updatesEnabled()) return Result.success()
        val context = applicationContext
        val state = Deps.state(context)
        val dir = Updates.dir(context)
        return when (val outcome = Updates.prepare(state, Deps.updater(), dir, Deps.versionCode())) {
            is Updates.Outcome.Failed -> Result.retry()
            is Updates.Outcome.Ready -> {
                if (Deps.canInstallSilently(context) && Updates.verify(outcome, state, dir)) {
                    try {
                        Deps.install(context, outcome.apk, false)
                    } catch (e: Exception) {
                        Log.w("CzyzykUpdate", "background install not started: ${e.javaClass.simpleName}")
                    }
                }
                Result.success()
            }
            Updates.Outcome.UpToDate, Updates.Outcome.Unavailable -> Result.success()
        }
    }
}
