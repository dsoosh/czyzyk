package pl.czyzyk.app

import android.content.Context
import android.content.SharedPreferences

/** Non-secret local state: tracked-group cache, group reports, counters for the status screen. */
class AppState(private val prefs: SharedPreferences) {

    val trackedGroups: Set<String> get() = prefs.getStringSet(KEY_TRACKED, emptySet()).orEmpty()
    private val trackedFetchedAt: Long get() = prefs.getLong(KEY_TRACKED_AT, 0)
    var configTtlMillis: Long
        get() = prefs.getLong(KEY_TTL, DEFAULT_TTL_MILLIS)
        private set(v) = prefs.edit().putLong(KEY_TTL, v).apply()

    fun saveTrackedGroups(groups: Set<String>, ttlMillis: Long, now: Long = System.currentTimeMillis()) {
        prefs.edit().putStringSet(KEY_TRACKED, HashSet(groups)).putLong(KEY_TRACKED_AT, now).apply()
        configTtlMillis = ttlMillis
    }

    fun trackedGroupsStale(now: Long = System.currentTimeMillis()) = now - trackedFetchedAt >= configTtlMillis

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

    var lastDeliveredAt: Long
        get() = prefs.getLong(KEY_LAST_DELIVERED, 0)
        set(v) = prefs.edit().putLong(KEY_LAST_DELIVERED, v).apply()

    companion object {
        const val DEFAULT_TTL_MILLIS = 15 * 60 * 1000L
        private const val KEY_TRACKED = "tracked_groups"
        private const val KEY_TRACKED_AT = "tracked_groups_at"
        private const val KEY_TTL = "config_ttl"
        private const val KEY_REPORTED = "reported_groups"
        private const val KEY_PENDING_REPORTS = "pending_group_reports"
        private const val KEY_ATTACHMENTS = "pending_attachments"
        private const val KEY_LAST_DELIVERED = "last_delivered_at"

        @Volatile private var instance: AppState? = null

        fun get(context: Context): AppState = instance ?: synchronized(this) {
            instance ?: AppState(context.applicationContext.getSharedPreferences("czyzyk_state", Context.MODE_PRIVATE))
                .also { instance = it }
        }
    }
}
