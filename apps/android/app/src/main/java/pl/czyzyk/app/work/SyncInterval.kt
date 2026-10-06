package pl.czyzyk.app.work

/** How often the tracked-group list is refreshed; 15 min is WorkManager's periodic minimum. */
enum class SyncInterval(val minutes: Long, val label: String) {
    MIN_15(15, "15 min"),
    MIN_30(30, "30 min"),
    HOUR_1(60, "1 godz."),
    HOUR_3(180, "3 godz."),
    HOUR_6(360, "6 godz.");

    val millis: Long get() = minutes * 60_000

    companion object {
        val DEFAULT = MIN_15

        /** Unknown stored values (e.g. after the list changes) fall back to the default. */
        fun fromMinutes(minutes: Long): SyncInterval = entries.firstOrNull { it.minutes == minutes } ?: DEFAULT
    }
}
