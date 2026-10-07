package pl.czyzyk.app.photos

/** A photo notification remembered on the phone: when it was seen, and its message if from a tracked group. */
data class PhotoNote(
    val key: String,
    val seenAt: Long,
    /** Idempotency key of the queued message, or null for a private chat or an untracked group. */
    val trackedKey: String?,
    val groupName: String?,
)

/** A file in "WhatsApp Images" (MediaStore). */
data class MediaImage(val id: Long, val name: String, val addedAt: Long)

sealed interface PhotoMatch {
    /** The photo belongs to this tracked group message. */
    data class Message(val idempotencyKey: String) : PhotoMatch
    /** Photos from another chat arrived at the same time: the file stays on the phone. */
    data object Ambiguous : PhotoMatch
    /** No photo notification around the file (e.g. saved or forwarded by hand, muted chat). */
    data object NoNotification : PhotoMatch
}

/**
 * Links a WhatsApp image file to the photo message it came with, by time (document-import).
 * WhatsApp downloads a photo right after its notification, so the file appears shortly after
 * the notice. Only an unambiguous case counts: every photo notice in the window must come from
 * the same tracked group, otherwise a private or unrelated photo could be attached to it.
 */
object PhotoMatcher {
    /** A download may take a while on a slow network. */
    const val BEFORE_MILLIS = 10 * 60 * 1000L
    /** The file may be indexed slightly before the notification is handled. */
    const val AFTER_MILLIS = 2 * 60 * 1000L

    fun match(image: MediaImage, notes: List<PhotoNote>): PhotoMatch {
        val window = notes.filter { it.seenAt in (image.addedAt - BEFORE_MILLIS)..(image.addedAt + AFTER_MILLIS) }
        if (window.isEmpty()) return PhotoMatch.NoNotification
        if (window.any { it.trackedKey == null }) return PhotoMatch.Ambiguous
        if (window.map { it.groupName }.distinct().size > 1) return PhotoMatch.Ambiguous
        // An album: several photos of the same group – the closest notice at or before the file.
        val best = window.filter { it.seenAt <= image.addedAt + AFTER_MILLIS }.maxBy { it.seenAt }
        return PhotoMatch.Message(best.trackedKey!!)
    }
}
