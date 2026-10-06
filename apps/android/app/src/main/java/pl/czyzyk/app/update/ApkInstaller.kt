package pl.czyzyk.app.update

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInstaller
import android.os.Build
import android.util.Log
import android.widget.Toast
import androidx.core.content.IntentCompat
import java.io.File

/** Installs a downloaded update with a PackageInstaller session (no user action when Android allows it). */
object ApkInstaller {
    const val EXTRA_INTERACTIVE = "pl.czyzyk.app.update.INTERACTIVE"

    /** The user allowed this app to install apps ("Install unknown apps"). */
    fun allowed(context: Context): Boolean = context.packageManager.canRequestPackageInstalls()

    /** Android 12+ can update without asking when this app installed the current version itself. */
    fun canTrySilently(context: Context): Boolean = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && allowed(context)

    /** Blocking (copies the APK); call off the main thread. [interactive]: started by a tap, may open the system prompt. */
    fun install(context: Context, apk: File, interactive: Boolean) {
        val installer = context.packageManager.packageInstaller
        val params = PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL).apply {
            setAppPackageName(context.packageName)
            setSize(apk.length())
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_NOT_REQUIRED)
            }
        }
        val id = installer.createSession(params)
        try {
            installer.openSession(id).use { session ->
                session.openWrite("czyzyk.apk", 0, apk.length()).use { out ->
                    apk.inputStream().use { it.copyTo(out) }
                    session.fsync(out)
                }
                val result = Intent(context, InstallResultReceiver::class.java).putExtra(EXTRA_INTERACTIVE, interactive)
                // Mutable: the installer adds the status extras.
                val flags = PendingIntent.FLAG_UPDATE_CURRENT or
                    (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) PendingIntent.FLAG_MUTABLE else 0)
                session.commit(PendingIntent.getBroadcast(context, id, result, flags).intentSender)
            }
        } catch (e: Exception) {
            installer.abandonSession(id)
            throw e
        }
    }
}

/** Result of an install session; not exported, only the system calls it through our PendingIntent. */
class InstallResultReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val interactive = intent.getBooleanExtra(ApkInstaller.EXTRA_INTERACTIVE, false)
        when (val status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE)) {
            PackageInstaller.STATUS_PENDING_USER_ACTION -> {
                // From the background the update stays ready; the app offers it when opened.
                if (!interactive) return
                IntentCompat.getParcelableExtra(intent, Intent.EXTRA_INTENT, Intent::class.java)?.let {
                    context.startActivity(it.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
                }
            }
            PackageInstaller.STATUS_SUCCESS -> Unit
            else -> {
                Log.w("CzyzykUpdate", "update install failed: status=$status")
                if (interactive) {
                    Toast.makeText(context, "Nie udało się zainstalować aktualizacji.", Toast.LENGTH_LONG).show()
                }
            }
        }
    }
}
