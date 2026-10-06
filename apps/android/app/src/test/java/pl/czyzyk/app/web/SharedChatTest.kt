package pl.czyzyk.app.web

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

class SharedChatTest {
    private val chat = "07.10.2026, 18:02 - Pani Ania: W piątek bal"

    private fun zip(vararg files: Pair<String, ByteArray>): ByteArray {
        val out = ByteArrayOutputStream()
        ZipOutputStream(out).use { z ->
            for ((name, bytes) in files) {
                z.putNextEntry(ZipEntry(name))
                z.write(bytes)
                z.closeEntry()
            }
        }
        return out.toByteArray()
    }

    private fun item(name: String, type: String?, bytes: ByteArray) = SharedChatReader.Item(name, type) { ByteArrayInputStream(bytes) }

    @Test
    fun takesOnlyTheChatTextOutOfAZipWithMedia() {
        val bytes = zip(
            "IMG-20261007-WA0001.jpg" to ByteArray(1000) { 1 },
            "_chat.txt" to chat.toByteArray(),
            "notatki.txt" to "inne".toByteArray(),
        )
        val shared = SharedChatReader.read(listOf(item("WhatsApp Chat with SOKOŁY.zip", "application/zip", bytes)))
        assertEquals(SharedChat("WhatsApp Chat with SOKOŁY.zip", chat), shared)
    }

    @Test
    fun readsAPlainTextExportAmongSeveralFiles() {
        val shared = SharedChatReader.read(
            listOf(
                item("IMG-1.jpg", "image/jpeg", ByteArray(10)),
                item("Czat WhatsApp z SOKOŁY.txt", "text/plain", chat.toByteArray()),
            ),
        )
        assertEquals("Czat WhatsApp z SOKOŁY.txt", shared.fileName)
        assertEquals(chat, shared.text)
    }

    @Test
    fun rejectsPhotosAndZipsWithoutChat() {
        assertThrows(SharedChatException::class.java) { SharedChatReader.read(listOf(item("IMG-1.jpg", "image/jpeg", ByteArray(10)))) }
        assertThrows(SharedChatException::class.java) {
            SharedChatReader.read(listOf(item("x.zip", "application/zip", zip("IMG.jpg" to ByteArray(5)))))
        }
        assertThrows(SharedChatException::class.java) {
            SharedChatReader.read(listOf(item("x.zip", "application/zip", "nie zip".toByteArray())))
        }
    }

    @Test
    fun picksTheChatEntryLikeThePwa() {
        assertEquals("_chat.txt", SharedChatReader.pickChatEntry(listOf("a.txt", "_chat.txt")))
        assertEquals("WhatsApp Chat - X.txt", SharedChatReader.pickChatEntry(listOf("a.txt", "WhatsApp Chat - X.txt")))
        assertEquals("a.txt", SharedChatReader.pickChatEntry(listOf("a.txt")))
    }
}
