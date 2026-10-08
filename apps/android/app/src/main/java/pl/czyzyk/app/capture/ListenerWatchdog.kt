package pl.czyzyk.app.capture

import android.content.ComponentName
import android.content.Context
import android.content.pm.PackageManager
import android.os.Process
import android.os.SystemClock
import android.service.notification.NotificationListenerService
import android.util.Log
import androidx.core.app.NotificationManagerCompat

/**
 * Keeps the notification reader bound (notification-capture). Android unbinds a listener after
 * an app update, a process kill or under battery saving and does not always bind it again, so
 * notifications are silently lost. Called from the periodic sync, on app start and after an
 * update or reboot: when this process has no connected listener, the binding is renewed.
 */
object ListenerWatchdog {
    private const val TAG = "ListenerWatchdog"
    private const val GRACE_MILLIS = 20_000L

    /** Set by CaptureService in this process; false after a process restart until the system binds it. */
    @Volatile var connected: Boolean = false

    fun hasAccess(context: Context): Boolean = context.packageName in NotificationManagerCompat.getEnabledListenerPackages(context)

    /** Renews the binding when access is granted but the listener is not connected. Returns true when it acted. */
    fun ensureBound(context: Context): Boolean {
        if (connected || !hasAccess(context)) return false
        val component = ComponentName(context, CaptureService::class.java)
        try {
            NotificationListenerService.requestRebind(component)
        } catch (_: Exception) {
            // Not allowed in this state on some versions: fall through to the component toggle.
        }
        // A fresh process: the system may be binding the listener right now; give it time.
        if (SystemClock.elapsedRealtime() - Process.getStartElapsedRealtime() < GRACE_MILLIS) return true
        // Disabling and enabling the component makes the system drop and create the binding.
        val pm = context.packageManager
        pm.setComponentEnabledSetting(component, PackageManager.COMPONENT_ENABLED_STATE_DISABLED, PackageManager.DONT_KILL_APP)
        pm.setComponentEnabledSetting(component, PackageManager.COMPONENT_ENABLED_STATE_ENABLED, PackageManager.DONT_KILL_APP)
        Log.i(TAG, "notification listener not connected, binding renewed")
        return true
    }
}
