package pl.czyzyk.app.update

import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.io.IOException
import java.security.MessageDigest
import java.util.concurrent.TimeUnit

class UpdateException(message: String) : IOException(message)

/** Reads the latest release description and downloads its APK with size and SHA-256 checks. */
class Updater(
    private val source: ReleaseSource,
    private val client: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .build(),
) {
    /** The latest release, or null when it cannot be read (offline, no release yet, invalid file). */
    fun latest(): UpdateInfo? = try {
        client.newCall(Request.Builder().url(source.manifestUrl).build()).execute().use { r ->
            if (!r.isSuccessful) return null
            val source = r.body?.source() ?: return null
            source.request(MAX_MANIFEST_BYTES + 1)
            if (source.buffer.size > MAX_MANIFEST_BYTES) return null
            UpdateInfo.parse(source.buffer.readUtf8())
        }
    } catch (_: IOException) {
        null
    }

    /** Downloads the APK to [target]; the file exists afterwards only if it matches [info]. */
    fun download(info: UpdateInfo, target: File) {
        target.parentFile?.mkdirs()
        val part = File(target.path + ".part")
        try {
            client.newCall(Request.Builder().url(source.apkUrl(info)).build()).execute().use { r ->
                if (!r.isSuccessful) throw UpdateException("http ${r.code}")
                val body = r.body ?: throw UpdateException("empty body")
                val digest = MessageDigest.getInstance("SHA-256")
                var total = 0L
                body.byteStream().use { input ->
                    part.outputStream().use { out ->
                        val buffer = ByteArray(64 * 1024)
                        while (true) {
                            val n = input.read(buffer)
                            if (n < 0) break
                            total += n
                            if (total > info.size) throw UpdateException("larger than announced")
                            digest.update(buffer, 0, n)
                            out.write(buffer, 0, n)
                        }
                    }
                }
                if (total != info.size) throw UpdateException("size mismatch")
                if (digest.digest().toHex() != info.sha256) throw UpdateException("checksum mismatch")
            }
            if (!part.renameTo(target)) throw UpdateException("cannot store the update")
        } finally {
            part.delete()
        }
    }

    companion object {
        private const val MAX_MANIFEST_BYTES = 4096L

        fun sha256(file: File): String {
            val digest = MessageDigest.getInstance("SHA-256")
            file.inputStream().use { input ->
                val buffer = ByteArray(64 * 1024)
                while (true) {
                    val n = input.read(buffer)
                    if (n < 0) break
                    digest.update(buffer, 0, n)
                }
            }
            return digest.digest().toHex()
        }

        private fun ByteArray.toHex() = joinToString("") { "%02x".format(it) }
    }
}
