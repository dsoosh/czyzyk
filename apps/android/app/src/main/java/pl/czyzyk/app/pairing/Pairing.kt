package pl.czyzyk.app.pairing

import pl.czyzyk.app.web.WebRules
import java.net.URI
import java.net.URLDecoder

/** Server address and device token issued in the PWA admin panel (Admin → Urządzenia). */
data class Pairing(val serverUrl: String, val token: String) {
    override fun toString() = "Pairing(serverUrl=$serverUrl, token=***)" // never log the token
}

object PairingLink {
    private val TOKEN = Regex("^[0-9a-fA-F]{64}$")

    /**
     * Parses `czyzyk://pair?server=<url>&token=<64 hex>`. Returns null for anything else,
     * including non-https servers (plain http is accepted only for localhost/emulator).
     */
    fun parse(link: String): Pairing? {
        val uri = runCatching { URI(link.trim()) }.getOrNull() ?: return null
        if (uri.scheme != "czyzyk" || uri.host != "pair") return null
        val params = (uri.rawQuery ?: return null).split("&").mapNotNull {
            val parts = it.split("=", limit = 2)
            if (parts.size == 2) parts[0] to URLDecoder.decode(parts[1], "UTF-8") else null
        }.toMap()
        val server = params["server"]?.trimEnd('/') ?: return null
        val token = params["token"] ?: return null
        if (!TOKEN.matches(token)) return null
        val serverUri = runCatching { URI(server) }.getOrNull() ?: return null
        val local = serverUri.host in setOf("localhost", "127.0.0.1", "10.0.2.2")
        if (serverUri.scheme != "https" && !(serverUri.scheme == "http" && local)) return null
        if (serverUri.host.isNullOrBlank()) return null
        return Pairing(server, token.lowercase())
    }

    /** The PWA address from the optional `app` parameter (normalised), or null. */
    fun appUrl(link: String): String? {
        val uri = runCatching { URI(link.trim()) }.getOrNull() ?: return null
        if (uri.scheme != "czyzyk" || uri.host != "pair") return null
        val value = (uri.rawQuery ?: return null).split("&")
            .map { it.split("=", limit = 2) }
            .firstOrNull { it.size == 2 && it[0] == "app" }
            ?.let { URLDecoder.decode(it[1], "UTF-8") }
        return WebRules.normalizeAppUrl(value)
    }
}
