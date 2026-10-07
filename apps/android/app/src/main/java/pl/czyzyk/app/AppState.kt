package pl.czyzyk.app

import android.content.Context
import android.content.SharedPreferences
import pl.czyzyk.app.work.SyncInterval

data class ReadyUpdate(val versionCode: Long, val versionName: String, val sha256: String)

/** Non-secret local state: tracked-group cache, sync interval, group reports, counters for the status screen. */
class AppState(private val prefs: SharedPreferences) {

    val trackedGroups: Set<String> get() = prefs.getStringSet(KEY_TRACKED, emptySet()).orEmpty()
    val trackedFetchedAt: Long get() = prefs.getLong(KEY_TRACKED_AT, 0)
    var configTtlMillis: Long
        get() = prefs.getLong(KEY_TTL, DEFAULT_TTL_MILLIS)
        private set(v) = prefs.edit().putLong(KEY_TTL, v).apply()

    fun saveTrackedGroups(groups: Set<String>, ttlMillis: Long, now: Long = System.currentTimeMillis()) {
        prefs.edit().putStringSet(KEY_TRACKED, HashSet(groups)).putLong(KEY_TRACKED_AT, now).apply()
        configTtlMillis = ttlMillis
    }

    /** Chosen on the phone; the list is stale after the longer of the server TTL and this interval. */
    var syncInterval: SyncInterval
        get() = SyncInterval.fromMinutes(prefs.getLong(KEY_SYNC_INTERVAL, SyncInterval.DEFAULT.minutes))
        set(v) = prefs.edit().putLong(KEY_SYNC_INTERVAL, v.minutes).apply()

    fun trackedGroupsStale(now: Long = System.currentTimeMillis()) =
        now - trackedFetchedAt >= maxOf(configTtlMillis, syncInterval.millis)

    /** Group names already sent to the server or waiting to be sent. */
    val knownGroups: Set<String> get() = reportedGroups + pendingGroupReports
    private val reportedGroups: Set<String> get() = prefs.getStringSet(KEY_REPORTED, emptySet()).orEmpty()
    val pendingGroupReports: Set<String> get() = prefs.getStringSet(KEY_PENDING_REPORTS, emptySet()).orEmpty()

    @Synchronized fun addPendingGroupReport(name: String) {
        prefs.edit().putStringSet(KEY_PENDING_REPORTS, HashSet(pendingGroupReports + name)).apply()
    }

    @Synchronized fun markGroupsReported(names: Set<String>) {
        prefs.edit()
            .putStringSet(KEY_REPORTED, HashSet(reportedGroups + names))
            .putStringSet(KEY_PENDING_REPORTS, HashSet(pendingGroupReports - names))
            .apply()
    }

    /** Attachments seen in notifications since the last chat export (etap 4 resets it). */
    val pendingAttachments: Int get() = prefs.getInt(KEY_ATTACHMENTS, 0)
    @Synchronized fun incrementAttachments() = prefs.edit().putInt(KEY_ATTACHMENTS, pendingAttachments + 1).apply()

    /** Origin of the PWA shown as the app's main view (from pairing or typed in), or null. */
    var appUrl: String?
        get() = prefs.getString(KEY_APP_URL, null)
        set(v) = prefs.edit().putString(KEY_APP_URL, v).apply()

    /** When the app last read the latest release description (app-updates). */
    var lastUpdateCheckAt: Long
        get() = prefs.getLong(KEY_UPDATE_CHECKED, 0)
        set(v) = prefs.edit().putLong(KEY_UPDATE_CHECKED, v).apply()

    /** A downloaded and verified update waiting to be installed, or null. */
    var readyUpdate: ReadyUpdate?
        get() {
            val code = prefs.getLong(KEY_UPDATE_CODE, 0)
            val name = prefs.getString(KEY_UPDATE_NAME, null)
            val sha = prefs.getString(KEY_UPDATE_SHA, null)
            return if (code > 0 && name != null && sha != null) ReadyUpdate(code, name, sha) else null
        }
        set(v) = prefs.edit().apply {
            if (v == null) remove(KEY_UPDATE_CODE).remove(KEY_UPDATE_NAME).remove(KEY_UPDATE_SHA)
            else putLong(KEY_UPDATE_CODE, v.versionCode).putString(KEY_UPDATE_NAME, v.versionName).putString(KEY_UPDATE_SHA, v.sha256)
        }.apply()

    /** The user turned on screening of WhatsApp photos from tracked groups (document-import). */
    var photosEnabled: Boolean
        get() = prefs.getBoolean(KEY_PHOTOS, false)
        set(v) = prefs.edit().putBoolean(KEY_PHOTOS, v).apply()

    /** Documents delivered to the server and photos kept on the phone, for the status screen. */
    val documentsSent: Int get() = prefs.getInt(KEY_DOCUMENTS_SENT, 0)
    val photosWithheld: Int get() = prefs.getInt(KEY_PHOTOS_WITHHELD, 0)
    @Synchronized fun incrementDocumentsSent() = prefs.edit().putInt(KEY_DOCUMENTS_SENT, documentsSent + 1).apply()
    @Synchronized fun incrementPhotosWithheld() = prefs.edit().putInt(KEY_PHOTOS_WITHHELD, photosWithheld + 1).apply()

    /**
     * Notification previews (experiment): photos seen in tracked groups, how many came with a
     * preview, how many the app could read, and the shorter side of the largest one in px.
     */
    val trackedPhotos: Int get() = prefs.getInt(KEY_TRACKED_PHOTOS, 0)
    val previewsAttached: Int get() = prefs.getInt(KEY_PREVIEWS_ATTACHED, 0)
    val previewsRead: Int get() = prefs.getInt(KEY_PREVIEWS_READ, 0)
    val previewMaxSide: Int get() = prefs.getInt(KEY_PREVIEW_MAX_SIDE, 0)
    @Synchronized fun incrementTrackedPhotos() = prefs.edit().putInt(KEY_TRACKED_PHOTOS, trackedPhotos + 1).apply()
    @Synchronized fun incrementPreviewsAttached() = prefs.edit().putInt(KEY_PREVIEWS_ATTACHED, previewsAttached + 1).apply()
    @Synchronized fun recordPreviewRead(shorterSide: Int) = prefs.edit()
        .putInt(KEY_PREVIEWS_READ, previewsRead + 1)
        .putInt(KEY_PREVIEW_MAX_SIDE, maxOf(previewMaxSide, shorterSide))
        .apply()

    var lastDeliveredAt: Long
        get() = prefs.getLong(KEY_LAST_DELIVERED, 0)
        set(v) = prefs.edit().putLong(KEY_LAST_DELIVERED, v).apply()

    companion object {
        const val DEFAULT_TTL_MILLIS = 15 * 60 * 1000L
        private const val KEY_PHOTOS = "photos_enabled"
        private const val KEY_DOCUMENTS_SENT = "documents_sent"
        private const val KEY_PHOTOS_WITHHELD = "photos_withheld"
        private const val KEY_TRACKED_PHOTOS = "tracked_photos"
        private const val KEY_PREVIEWS_ATTACHED = "previews_attached"
        private const val KEY_PREVIEWS_READ = "previews_read"
        private const val KEY_PREVIEW_MAX_SIDE = "preview_max_side"
        private const val KEY_TRACKED = "tracked_groups"
        private const val KEY_TRACKED_AT = "tracked_groups_at"
        private const val KEY_TTL = "config_ttl"
        private const val KEY_SYNC_INTERVAL = "sync_interval_minutes"
        private const val KEY_REPORTED = "reported_groups"
        private const val KEY_PENDING_REPORTS = "pending_group_reports"
        private const val KEY_ATTACHMENTS = "pending_attachments"
        private const val KEY_LAST_DELIVERED = "last_delivered_at"
        private const val KEY_APP_URL = "app_url"
        private const val KEY_UPDATE_CHECKED = "update_checked_at"
        private const val KEY_UPDATE_CODE = "update_ready_code"
        private const val KEY_UPDATE_NAME = "update_ready_name"
        private const val KEY_UPDATE_SHA = "update_ready_sha256"

        @Volatile private var instance: AppState? = null

        fun get(context: Context): AppState = instance ?: synchronized(this) {
            instance ?: AppState(context.applicationContext.getSharedPreferences("czyzyk_state", Context.MODE_PRIVATE))
                .also { instance = it }
        }
    }
}
