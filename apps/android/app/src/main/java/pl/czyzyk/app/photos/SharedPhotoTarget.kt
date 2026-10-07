package pl.czyzyk.app.photos

/** Where a photo shared to the app by hand belongs (document-import, groups with chat privacy on). */
sealed interface SharedPhotoTarget {
    /** One tracked group sent photos recently: its newest photo message. */
    data class Single(val note: PhotoNote) : SharedPhotoTarget
    /** Several groups did: the newest photo message of each, newest group first; the user picks. */
    data class Choose(val options: List<PhotoNote>) : SharedPhotoTarget
    /** No photo from a tracked group recently: nothing to attach it to. */
    data object None : SharedPhotoTarget

    companion object {
        /** Photos older than this are not offered. */
        const val WINDOW_MILLIS = 12 * 60 * 60 * 1000L

        fun choose(notes: List<PhotoNote>, now: Long): SharedPhotoTarget {
            val newestPerGroup = notes
                .filter { it.trackedKey != null && it.groupName != null && it.seenAt >= now - WINDOW_MILLIS }
                .groupBy { it.groupName }
                .map { (_, group) -> group.maxBy { it.seenAt } }
                .sortedByDescending { it.seenAt }
            return when (newestPerGroup.size) {
                0 -> None
                1 -> Single(newestPerGroup.single())
                else -> Choose(newestPerGroup)
            }
        }
    }
}
