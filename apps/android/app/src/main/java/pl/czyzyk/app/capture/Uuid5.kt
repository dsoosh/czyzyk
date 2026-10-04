package pl.czyzyk.app.capture

import java.nio.ByteBuffer
import java.security.MessageDigest
import java.util.UUID

/** Name-based UUID (RFC 4122 version 5, SHA-1). */
object Uuid5 {
    /** Namespace for Czyżyk message keys (a fixed random UUID). */
    val MESSAGES: UUID = UUID.fromString("6d1f5a8e-3c2b-4f7e-9a41-2c0b8e7d5f13")

    fun of(namespace: UUID, name: String): UUID {
        val sha1 = MessageDigest.getInstance("SHA-1")
        sha1.update(ByteBuffer.allocate(16).putLong(namespace.mostSignificantBits).putLong(namespace.leastSignificantBits).array())
        val hash = sha1.digest(name.toByteArray(Charsets.UTF_8))
        hash[6] = ((hash[6].toInt() and 0x0f) or 0x50).toByte()
        hash[8] = ((hash[8].toInt() and 0x3f) or 0x80).toByte()
        val buf = ByteBuffer.wrap(hash, 0, 16)
        return UUID(buf.long, buf.long)
    }
}
