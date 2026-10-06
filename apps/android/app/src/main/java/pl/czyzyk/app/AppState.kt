package pl.czyzyk.app

import android.content.Context
import android.content.SharedPreferences
import pl.czyzyk.app.work.SyncInterval

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

    var lastDeliveredAt: Long
        get() = prefs.getLong(KEY_LAST_DELIVERED, 0)
        set(v) = prefs.edit().putLong(KEY_LAST_DELIVERED, v).apply()

    companion object {
        const val DEFAULT_TTL_MILLIS = 15 * 60 * 1000L
        private const val KEY_TRACKED = "tracked_groups"
        private const val KEY_TRACKED_AT = "tracked_groups_at"
        private const val KEY_TTL = "config_ttl"
        private const val KEY_SYNC_INTERVAL = "sync_interval_minutes"
        private const val KEY_REPORTED = "reported_groups"
        private const val KEY_PENDING_REPORTS = "pending_group_reports"
        private const val KEY_ATTACHMENTS = "pending_attachments"
        private const val KEY_LAST_DELIVERED = "last_delivered_at"
        private const val KEY_APP_URL = "app_url"

        @Volatile private var instance: AppState? = null

        fun get(context: Context): AppState = instance ?: synchronized(this) {
            instance ?: AppState(context.applicationContext.getSharedPreferences("czyzyk_state", Context.MODE_PRIVATE))
                .also { instance = it }
        }
    }
}
