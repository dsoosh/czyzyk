package pl.czyzyk.app.update

import android.content.Context
import pl.czyzyk.app.AppState
import pl.czyzyk.app.ReadyUpdate
import java.io.File
import java.io.IOException

/** Check → download → keep one verified APK of a newer version ready to install (app-updates). */
object Updates {
    /** Opening the app checks again only after this long; the background check runs daily. */
    const val CHECK_ON_OPEN_MILLIS = 6 * 60 * 60 * 1000L

    sealed interface Outcome {
        /** The latest release could not be read (offline, no release yet). */
        data object Unavailable : Outcome
        data object UpToDate : Outcome
        data class Ready(val update: ReadyUpdate, val apk: File) : Outcome
        data class Failed(val reason: String) : Outcome
    }

    fun dir(context: Context) = File(context.filesDir, "updates")

    fun apkFile(dir: File, versionCode: Long) = File(dir, "czyzyk-$versionCode.apk")

    fun shouldCheckOnOpen(state: AppState, now: Long = System.currentTimeMillis()) =
        now - state.lastUpdateCheckAt >= CHECK_ON_OPEN_MILLIS

    fun prepare(
        state: AppState,
        updater: Updater,
        dir: File,
        currentVersion: Long,
        now: Long = System.currentTimeMillis(),
    ): Outcome {
        val info = updater.latest() ?: return Outcome.Unavailable
        state.lastUpdateCheckAt = now
        if (info.versionCode <= currentVersion) {
            forget(state, dir)
            return Outcome.UpToDate
        }
        val ready = ReadyUpdate(info.versionCode, info.versionName, info.sha256)
        val apk = apkFile(dir, info.versionCode)
        if (state.readyUpdate == ready && apk.exists()) return Outcome.Ready(ready, apk)
        forget(state, dir)
        return try {
            updater.download(info, apk)
            state.readyUpdate = ready
            Outcome.Ready(ready, apk)
        } catch (e: IOException) {
            Outcome.Failed(e.message ?: e.javaClass.simpleName)
        }
    }

    /** The downloaded update when it is still newer than the installed app; otherwise cleans up. */
    fun ready(state: AppState, dir: File, currentVersion: Long): Outcome.Ready? {
        val update = state.readyUpdate
        val apk = update?.let { apkFile(dir, it.versionCode) }
        if (update == null || apk == null || update.versionCode <= currentVersion || !apk.exists()) {
            forget(state, dir)
            return null
        }
        return Outcome.Ready(update, apk)
    }

    /** Re-hashes the file right before installing; a changed file is deleted. */
    fun verify(ready: Outcome.Ready, state: AppState, dir: File): Boolean {
        if (Updater.sha256(ready.apk) == ready.update.sha256) return true
        forget(state, dir)
        return false
    }

    private fun forget(state: AppState, dir: File) {
        if (state.readyUpdate != null) state.readyUpdate = null
        dir.listFiles()?.forEach { it.delete() }
    }
}
