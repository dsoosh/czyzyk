package pl.czyzyk.app.web

import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.io.InputStream
import java.util.zip.ZipInputStream

/** Chat text taken out of a shared WhatsApp export, handed to the PWA import page. */
data class SharedChat(val fileName: String, val text: String) {
    fun toJson(): String = JSONObject().put("fileName", fileName).put("text", text).toString()
}

class SharedChatException(message: String) : Exception(message)

/**
 * Reads a WhatsApp chat export shared to the app (chat-export-upload). From a ZIP only the
 * chat text is read – photos and videos are skipped without being decompressed and never
 * leave the phone. Same file choice as the PWA (apps/pwa/src/lib/chatImport.ts).
 */
object SharedChatReader {
    const val MAX_TEXT_BYTES = 15 * 1024 * 1024
    private val ZIP_TYPES = setOf("application/zip", "application/x-zip-compressed", "application/x-zip")
    private val CHAT_NAME = Regex("^(WhatsApp Chat|Czat WhatsApp)", RegexOption.IGNORE_CASE)

    /** One shared file: display name, MIME type and a way to open it. */
    class Item(val name: String, val type: String?, val open: () -> InputStream)

    fun isChatText(name: String) = name.endsWith(".txt", ignoreCase = true) && '/' !in name && !name.startsWith("__MACOSX")

    /** `_chat.txt` (Android/iOS export), then "WhatsApp Chat…"/"Czat WhatsApp…", then the first .txt. */
    fun pickChatEntry(names: List<String>): String? =
        names.firstOrNull { it == "_chat.txt" } ?: names.firstOrNull { CHAT_NAME.containsMatchIn(it) } ?: names.firstOrNull()

    fun read(items: List<Item>): SharedChat {
        items.firstOrNull { isZip(it) }?.let { zip ->
            val files = readZipText(zip.open)
            val name = pickChatEntry(files.keys.toList()) ?: throw SharedChatException("W paczce nie ma pliku czatu (.txt).")
            return SharedChat(zip.name, files.getValue(name).toString(Charsets.UTF_8))
        }
        val texts = items.filter { isChatText(it.name) || it.type == "text/plain" }
        val chosen = pickChatEntry(texts.map { it.name })?.let { name -> texts.first { it.name == name } }
            ?: throw SharedChatException("To nie jest eksport czatu WhatsApp.")
        return SharedChat(chosen.name, chosen.open().use { readLimited(it) }.toString(Charsets.UTF_8))
    }

    private fun isZip(item: Item) = item.name.endsWith(".zip", ignoreCase = true) || item.type in ZIP_TYPES

    /** Only top-level .txt entries are read; everything else is skipped by the stream. */
    private fun readZipText(open: () -> InputStream): Map<String, ByteArray> {
        val files = LinkedHashMap<String, ByteArray>()
        try {
            ZipInputStream(open()).use { zip ->
                while (true) {
                    val entry = zip.nextEntry ?: break
                    if (!entry.isDirectory && isChatText(entry.name)) files[entry.name] = readLimited(zip)
                }
            }
        } catch (e: SharedChatException) {
            throw e
        } catch (_: Exception) {
            throw SharedChatException("Nie udało się otworzyć pliku ZIP.")
        }
        return files
    }

    private fun readLimited(input: InputStream): ByteArray {
        val out = ByteArrayOutputStream()
        val buffer = ByteArray(64 * 1024)
        while (true) {
            val n = input.read(buffer)
            if (n < 0) break
            out.write(buffer, 0, n)
            if (out.size() > MAX_TEXT_BYTES) throw SharedChatException("Plik czatu jest za duży (limit 15 MB).")
        }
        return out.toByteArray()
    }
}
