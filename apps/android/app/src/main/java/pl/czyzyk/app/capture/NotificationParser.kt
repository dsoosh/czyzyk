package pl.czyzyk.app.capture

import android.app.Notification
import android.net.Uri
import androidx.core.app.NotificationCompat

/** One message read from a WhatsApp notification. */
data class CapturedMessage(
    val waPackage: String,
    val groupName: String,
    val author: String,
    val text: String,
    val sentAtMillis: Long,
    val hasAttachment: Boolean,
    /** Stable for the same message, so re-shown notifications never create duplicates. */
    val idempotencyKey: String,
)

/**
 * A photo seen in any WhatsApp notification, also from private chats and untracked groups
 * (document-import): only its time and the group it came from, never content. It lets the
 * phone tell which chat a new file in "WhatsApp Images" belongs to.
 */
data class PhotoNotice(
    /** Same key as the captured message for a group photo. */
    val key: String,
    /** Group name, or null for a private chat. */
    val groupName: String?,
    val sentAtMillis: Long,
    /** Preview of the photo WhatsApp attached to the notification, if any (may not be readable). */
    val imageUri: Uri? = null,
)

sealed interface ParseResult {
    data class Group(val groupName: String, val messages: List<CapturedMessage>) : ParseResult
    data class Skip(val reason: String) : ParseResult
}

/**
 * Reads WhatsApp notifications through the system MessagingStyle API (notification-capture).
 * Nothing here talks to WhatsApp itself.
 */
object NotificationParser {
    val WHATSAPP_PACKAGES = setOf("com.whatsapp", "com.whatsapp.w4b")

    /** "Motylki (3 wiadomości)", "Motylki (2 messages)", "Motylki: 2 new messages" → "Motylki". */
    private val COUNT_SUFFIX = Regex("""\s*(\(\d+\s+[^)]*\)|:\s*\d+\s+\S+(\s+\S+)?)$""")

    /** Placeholders WhatsApp shows instead of media: a media emoji (optionally with a caption)… */
    private val ATTACHMENT_EMOJI = Regex("""^\s*(?:📷|🎥|📹|📄|🎤|🎵|📎|🖼|👾)""")

    /** …or just the media type name, in Polish or English. */
    private val ATTACHMENT_WORD = Regex(
        """^(?:GIF|Zdjęcie|Photo|Film|Wideo|Video|Dokument|Document|Notatka głosowa|Wiadomość głosowa|Voice message|Audio|Naklejka|Sticker)$""",
        RegexOption.IGNORE_CASE,
    )

    fun parse(packageName: String, notification: Notification): ParseResult {
        if (packageName !in WHATSAPP_PACKAGES) return ParseResult.Skip("not whatsapp")
        if (notification.flags and Notification.FLAG_GROUP_SUMMARY != 0) return ParseResult.Skip("summary")
        val style = NotificationCompat.MessagingStyle.extractMessagingStyleFromNotification(notification)
            ?: return ParseResult.Skip("no messaging style")
        if (!style.isGroupConversation) return ParseResult.Skip("private chat")
        val title = style.conversationTitle?.toString()?.let { COUNT_SUFFIX.replace(GroupNames.normalize(it), "").trim() }
        if (title.isNullOrEmpty()) return ParseResult.Skip("no group name")

        val messages = style.messages.mapNotNull { m ->
            val text = m.text?.toString() ?: return@mapNotNull null
            val author = m.person?.name?.toString()?.trim().takeUnless { it.isNullOrEmpty() } ?: return@mapNotNull null
            CapturedMessage(
                waPackage = packageName,
                groupName = title,
                author = author,
                text = text,
                sentAtMillis = m.timestamp,
                hasAttachment = isAttachmentPlaceholder(text),
                idempotencyKey = Uuid5.of(Uuid5.MESSAGES, listOf(packageName, title, author, m.timestamp, text).joinToString("\u0000")).toString(),
            )
        }
        if (messages.isEmpty()) return ParseResult.Skip("no messages")
        return ParseResult.Group(title, messages)
    }

    /** "📷 Zdjęcie", "📷 caption", "Photo" – a photo, not a video, sticker or document. */
    private val PHOTO = Regex("""^\s*(?:📷|🖼)|^(?:Zdjęcie|Photo|Obraz|Image)$""", RegexOption.IGNORE_CASE)

    fun isPhotoPlaceholder(text: String): Boolean = PHOTO.containsMatchIn(text.trim())

    /** Photos in a WhatsApp notification of any chat (group or private). */
    fun photoNotices(packageName: String, notification: Notification): List<PhotoNotice> {
        if (packageName !in WHATSAPP_PACKAGES) return emptyList()
        if (notification.flags and Notification.FLAG_GROUP_SUMMARY != 0) return emptyList()
        val style = NotificationCompat.MessagingStyle.extractMessagingStyleFromNotification(notification) ?: return emptyList()
        val group = style.isGroupConversation
        val title = style.conversationTitle?.toString()?.let { COUNT_SUFFIX.replace(GroupNames.normalize(it), "").trim() }
        return style.messages.mapNotNull { m ->
            val text = m.text?.toString() ?: return@mapNotNull null
            if (!isPhotoPlaceholder(text)) return@mapNotNull null
            val author = m.person?.name?.toString()?.trim().orEmpty()
            val chat = (if (group) title else null) ?: author
            PhotoNotice(
                key = Uuid5.of(Uuid5.MESSAGES, listOf(packageName, chat, author, m.timestamp, text).joinToString("\u0000")).toString(),
                groupName = if (group && !title.isNullOrEmpty()) title else null,
                sentAtMillis = m.timestamp,
                imageUri = m.dataUri?.takeIf { m.dataMimeType?.startsWith("image/") == true },
            )
        }
    }

    fun isAttachmentPlaceholder(text: String): Boolean =
        ATTACHMENT_EMOJI.containsMatchIn(text) || ATTACHMENT_WORD.matches(text.trim())
}
