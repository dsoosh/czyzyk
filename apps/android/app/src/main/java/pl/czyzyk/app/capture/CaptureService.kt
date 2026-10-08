package pl.czyzyk.app.capture

import android.content.ComponentName
import android.graphics.BitmapFactory
import android.os.PowerManager
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import pl.czyzyk.app.photos.PhotoNote
import pl.czyzyk.app.work.Deps
import pl.czyzyk.app.work.DrainResult
import pl.czyzyk.app.work.Outbox
import pl.czyzyk.app.work.Work
import java.io.File
import kotlin.concurrent.thread

/**
 * Reads WhatsApp notifications (requires the user to grant notification access).
 * Only messages from tracked groups are queued for upload; other groups contribute
 * just their name, so the admin can decide whether to track them.
 */
class CaptureService : NotificationListenerService() {

    override fun onListenerConnected() {
        ListenerWatchdog.connected = true
        Deps.state(this).listenerConnectedAt = System.currentTimeMillis()
        ReaderService.start(this)
        Work.schedulePeriodicSync(this)
        Work.enqueueSync(this)
        Work.enqueueSend(this)
    }

    /** Android unbound the reader (update, battery saving): ask to be bound again right away. */
    override fun onListenerDisconnected() {
        ListenerWatchdog.connected = false
        Deps.state(this).listenerDisconnectedAt = System.currentTimeMillis()
        requestRebind(ComponentName(this, CaptureService::class.java))
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
        val previews = mutableListOf<PhotoNotice>()
        for (notice in notices) {
            val isTracked = notice.groupName != null && notice.groupName in tracked
            trackedPhoto = trackedPhoto || isTracked
            val isNew = log.addNote(PhotoNote(notice.key, now, if (isTracked) notice.key else null, if (isTracked) notice.groupName else null))
            if (isTracked && isNew) {
                Deps.state(this).incrementTrackedPhotos()
                // Previews are read only for tracked groups; other chats contribute just a time.
                if (notice.imageUri != null) previews += notice
            }
        }
        if (previews.isNotEmpty()) thread(name = "photo-previews") { keepPreviews(previews) }
        if (trackedPhoto) Work.enqueuePhotos(this, PHOTO_DELAY_SECONDS)
    }

    /**
     * Copies notification previews of tracked photos to private storage while WhatsApp's grant
     * lasts (groups with chat privacy never save the photo itself). Counters show whether this
     * works on the phone at all and how large the previews are.
     */
    private fun keepPreviews(previews: List<PhotoNotice>) {
        val state = Deps.state(this)
        val log = Deps.photos(this)
        val dir = File(filesDir, "previews").apply { mkdirs() }
        for (notice in previews) {
            state.incrementPreviewsAttached()
            val file = File(dir, "${notice.key}.img")
            val copied = runCatching {
                contentResolver.openInputStream(notice.imageUri!!)?.use { input ->
                    file.outputStream().use { out -> input.copyTo(out) }
                } != null
            }.getOrDefault(false)
            if (!copied || file.length() == 0L) {
                file.delete()
                continue
            }
            val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
            BitmapFactory.decodeFile(file.path, bounds)
            state.recordPreviewRead(minOf(bounds.outWidth, bounds.outHeight))
            if (!log.addPreview(notice.key, file.path)) file.delete()
        }
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
        if (added > 0) sendNow()
        if (state.trackedGroupsStale()) Work.enqueueSync(this)
    }

    /**
     * Sends right away from the listener, which keeps running with the screen off; WorkManager
     * would wait for a Doze maintenance window. Anything left (no network, 5xx) goes to the
     * backoff of SendWorker.
     */
    private fun sendNow() {
        val context = applicationContext
        thread(name = "send-now") {
            val wakeLock = context.getSystemService(PowerManager::class.java)
                .newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "czyzyk:send")
                .apply { acquire(SEND_WAKE_LOCK_MILLIS) }
            try {
                val result = runCatching { Outbox.drain(context) }.getOrDefault(DrainResult.RETRY)
                if (result == DrainResult.RETRY) Work.enqueueSend(context)
            } finally {
                if (wakeLock.isHeld) wakeLock.release()
            }
        }
    }

    companion object {
        /** Upper bound of one immediate send (a batch over a slow network). */
        private const val SEND_WAKE_LOCK_MILLIS = 60 * 1000L
        /** Time for WhatsApp to download the photo before the check. */
        private const val PHOTO_DELAY_SECONDS = 90L
    }
}
