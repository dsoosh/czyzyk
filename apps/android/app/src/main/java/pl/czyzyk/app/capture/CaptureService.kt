package pl.czyzyk.app.capture

import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import pl.czyzyk.app.work.Deps
import pl.czyzyk.app.work.Work

/**
 * Reads WhatsApp notifications (requires the user to grant notification access).
 * Only messages from tracked groups are queued for upload; other groups contribute
 * just their name, so the admin can decide whether to track them.
 */
class CaptureService : NotificationListenerService() {

    override fun onListenerConnected() {
        Work.schedulePeriodicSync(this)
        Work.enqueueSync(this)
        Work.enqueueSend(this)
    }

    override fun onNotificationPosted(sbn: StatusBarNotification) {
        if (sbn.packageName !in NotificationParser.WHATSAPP_PACKAGES) return
        handle(NotificationParser.parse(sbn.packageName, sbn.notification))
    }

    private fun handle(result: ParseResult) {
        if (result !is ParseResult.Group) return
        val state = Deps.state(this)
        if (Deps.store(this).pairing == null) return

        val decision = CapturePolicy.decide(result, state.trackedGroups, state.knownGroups)
        decision.groupToReport?.let {
            state.addPendingGroupReport(it)
            Work.enqueueSync(this)
        }

        val queue = Deps.queue(this)
        var added = 0
        for (message in decision.toQueue) {
            if (queue.enqueue(message)) {
                added++
                if (message.hasAttachment) state.incrementAttachments()
            }
        }
        if (added > 0) Work.enqueueSend(this)
        if (state.trackedGroupsStale()) Work.enqueueSync(this)
    }
}
