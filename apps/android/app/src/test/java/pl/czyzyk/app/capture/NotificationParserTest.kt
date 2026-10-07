package pl.czyzyk.app.capture

import android.app.Notification
import androidx.core.app.NotificationCompat
import androidx.core.app.Person
import androidx.test.core.app.ApplicationProvider
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class NotificationParserTest {
    private val context = ApplicationProvider.getApplicationContext<android.content.Context>()
    private val me = Person.Builder().setName("Ja").build()

    private fun notification(
        title: String?,
        group: Boolean,
        vararg messages: Triple<String, String, Long>,
        summary: Boolean = false,
    ): Notification {
        val style = NotificationCompat.MessagingStyle(me).setConversationTitle(title).setGroupConversation(group)
        for ((author, text, ts) in messages) style.addMessage(text, ts, Person.Builder().setName(author).build())
        return NotificationCompat.Builder(context, "test")
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setStyle(style)
            .setGroupSummary(summary)
            .setGroup("whatsapp")
            .build()
    }

    @Test
    fun normalizesGroupNameWithBidiIsolatesAndCountSuffix() {
        val n = notification("\u2068SOKOŁY - Cztery Żywioły\u2069 (2 wiadomości)", true, Triple("Ciocia", "Jutro ognisko", 1_791_388_920_000))
        val result = NotificationParser.parse("com.whatsapp", n) as ParseResult.Group
        assertEquals("SOKOŁY - Cztery Żywioły", result.groupName)
        assertEquals("SOKOŁY - Cztery Żywioły", result.messages.single().groupName)
    }

    @Test
    fun readsGroupMessageWithAuthorTextAndTime() {
        val n = notification("Motylki 2026/27", true, Triple("Pani Ania", "W piątek bal, przebrania", 1_791_388_920_000))
        val result = NotificationParser.parse("com.whatsapp", n) as ParseResult.Group
        assertEquals("Motylki 2026/27", result.groupName)
        val m = result.messages.single()
        assertEquals("Pani Ania", m.author)
        assertEquals("W piątek bal, przebrania", m.text)
        assertEquals(1_791_388_920_000, m.sentAtMillis)
        assertFalse(m.hasAttachment)
        assertEquals("com.whatsapp", m.waPackage)
    }

    @Test
    fun splitsSeveralMessagesAndKeepsKeysStableAcrossReShownNotifications() {
        val first = NotificationParser.parse(
            "com.whatsapp",
            notification("Motylki", true, Triple("Pani Ania", "Dzień dobry", 1000), Triple("Mama Zosi", "Dzięki", 2000)),
        ) as ParseResult.Group
        val again = NotificationParser.parse(
            "com.whatsapp",
            notification(
                "Motylki (3 wiadomości)",
                true,
                Triple("Pani Ania", "Dzień dobry", 1000),
                Triple("Mama Zosi", "Dzięki", 2000),
                Triple("Pani Ania", "Jutro kasztany", 3000),
            ),
        ) as ParseResult.Group
        assertEquals(2, first.messages.size)
        assertEquals("Motylki", again.groupName)
        assertEquals(first.messages.map { it.idempotencyKey }, again.messages.take(2).map { it.idempotencyKey })
        assertEquals(3, again.messages.map { it.idempotencyKey }.toSet().size)
    }

    @Test
    fun skipsPrivateChatsSummariesAndOtherApps() {
        val private = notification("Ania", false, Triple("Ania", "Cześć", 1000))
        assertTrue(NotificationParser.parse("com.whatsapp", private) is ParseResult.Skip)

        val summary = notification("Motylki", true, Triple("Pani Ania", "x", 1000), summary = true)
        assertEquals(ParseResult.Skip("summary"), NotificationParser.parse("com.whatsapp", summary))

        val noStyle = NotificationCompat.Builder(context, "test")
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle("WhatsApp")
            .setContentText("5 nowych wiadomości z 2 czatów")
            .build()
        assertTrue(NotificationParser.parse("com.whatsapp", noStyle) is ParseResult.Skip)

        val other = notification("Motylki", true, Triple("Pani Ania", "x", 1000))
        assertEquals(ParseResult.Skip("not whatsapp"), NotificationParser.parse("org.telegram.messenger", other))
    }

    @Test
    fun acceptsWhatsAppBusiness() {
        val n = notification("Motylki", true, Triple("Pani Ania", "x", 1000))
        assertTrue(NotificationParser.parse("com.whatsapp.w4b", n) is ParseResult.Group)
    }

    @Test
    fun recognisesAttachmentPlaceholdersInPolishAndEnglish() {
        listOf("📷 Zdjęcie", "📷 Photo", "🎥 Film", "📄 plan_pazdziernik.pdf", "🎤 Notatka głosowa (0:12)", "📷", "Zdjęcie", "Sticker", "📷 Dzisiejsze zajęcia")
            .forEach { assertTrue(it, NotificationParser.isAttachmentPlaceholder(it)) }
        listOf("Zdjęcia z wycieczki są super", "Photos tomorrow", "Film o dinozaurach w piątek", "W piątek bal 🎉")
            .forEach { assertFalse(it, NotificationParser.isAttachmentPlaceholder(it)) }
    }

    @Test
    fun photoNoticesComeFromGroupsAndPrivateChatsWithTheMessageKey() {
        val group = notification("Motylki", true, Triple("Pani Ania", "📷 Zdjęcie", 1000), Triple("Pani Ania", "Jadłospis w załączniku", 2000))
        val notice = NotificationParser.photoNotices("com.whatsapp", group).single()
        val message = (NotificationParser.parse("com.whatsapp", group) as ParseResult.Group).messages.first()
        assertEquals(PhotoNotice(message.idempotencyKey, "Motylki", 1000), notice)

        val private = notification("Mama", false, Triple("Mama", "📷 Photo", 3000))
        val privateNotice = NotificationParser.photoNotices("com.whatsapp", private).single()
        assertEquals(null, privateNotice.groupName)

        assertTrue(NotificationParser.photoNotices("com.whatsapp", notification("Motylki", true, Triple("A", "🎥 Film", 1))).isEmpty())
        assertTrue(NotificationParser.photoNotices("org.telegram", group).isEmpty())
    }

    @Test
    fun recognisesPhotoPlaceholdersOnly() {
        listOf("📷 Zdjęcie", "📷 Photo", "📷 Dzisiejsze zajęcia", "Zdjęcie", "Photo").forEach { assertTrue(it, NotificationParser.isPhotoPlaceholder(it)) }
        listOf("🎥 Film", "📄 plan.pdf", "Sticker", "Zdjęcia z wycieczki są super").forEach { assertFalse(it, NotificationParser.isPhotoPlaceholder(it)) }
    }

    @Test
    fun photoNoticeCarriesTheNotificationPreview() {
        val preview = android.net.Uri.parse("content://com.whatsapp.provider.media/item/1")
        val style = NotificationCompat.MessagingStyle(me).setConversationTitle("Motylki").setGroupConversation(true)
        style.addMessage(
            NotificationCompat.MessagingStyle.Message("📷 Zdjęcie", 1000, Person.Builder().setName("Pani Ania").build()).setData("image/jpeg", preview),
        )
        val n = NotificationCompat.Builder(context, "test").setSmallIcon(android.R.drawable.ic_dialog_info).setStyle(style).build()
        assertEquals(preview, NotificationParser.photoNotices("com.whatsapp", n).single().imageUri)
    }
}
