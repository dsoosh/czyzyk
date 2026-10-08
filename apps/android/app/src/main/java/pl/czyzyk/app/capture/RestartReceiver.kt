package pl.czyzyk.app.capture

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import pl.czyzyk.app.work.Work

/**
 * After a reboot or an app update (self-update included) Android does not always bind the
 * notification reader again (notification-capture): check it and restart the periodic sync.
 */
class RestartReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED && intent.action != Intent.ACTION_MY_PACKAGE_REPLACED) return
        ListenerWatchdog.ensureBound(context)
        Work.schedulePeriodicSync(context)
        Work.enqueueSync(context)
    }
}
