package pl.czyzyk.app.capture

import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import pl.czyzyk.app.photos.PhotoNote
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
        if (Deps.state(this).photosEnabled) notePhotos(NotificationParser.photoNotices(sbn.packageName, sbn.notification))
    }

    /**
     * Remembers when photos arrived in any chat (time only), so a new WhatsApp image file can be
     * told apart; a photo from a tracked group schedules the photo check (document-import).
     */
    private fun notePhotos(notices: List<PhotoNotice>) {
        if (notices.isEmpty() || Deps.store(this).pairing == null) return
        val tracked = Deps.state(this).trackedGroups
        val log = Deps.photos(this)
        val now = System.currentTimeMillis()
        var trackedPhoto = false
        for (notice in notices) {
            val isTracked = notice.groupName != null && notice.groupName in tracked
            trackedPhoto = trackedPhoto || isTracked
            log.addNote(PhotoNote(notice.key, now, if (isTracked) notice.key else null, if (isTracked) notice.groupName else null))
        }
        if (trackedPhoto) Work.enqueuePhotos(this, PHOTO_DELAY_SECONDS)
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

    companion object {
        /** Time for WhatsApp to download the photo before the check. */
        private const val PHOTO_DELAY_SECONDS = 90L
    }
}
