package pl.czyzyk.app.web

import java.net.URI
import java.net.URLDecoder

/** Rules for the PWA hosted in the WebView; plain JVM code so it is unit-tested. */
object WebRules {
    private val LOCAL_HOSTS = setOf("localhost", "127.0.0.1", "10.0.2.2")

    /**
     * Normalises the PWA address typed by the user or carried by the pairing link to an
     * origin ("https://host[:port]"). Only https, or http for localhost/emulator. Null otherwise.
     */
    fun normalizeAppUrl(input: String?): String? {
        val raw = input?.trim()?.takeIf { it.isNotEmpty() } ?: return null
        val withScheme = if ("://" in raw) raw else "https://$raw"
        val uri = runCatching { URI(withScheme) }.getOrNull() ?: return null
        val host = uri.host?.lowercase()?.takeIf { it.isNotBlank() } ?: return null
        val scheme = uri.scheme?.lowercase()
        if (scheme != "https" && !(scheme == "http" && host in LOCAL_HOSTS)) return null
        val port = if (uri.port == -1) "" else ":${uri.port}"
        return "$scheme://$host$port"
    }

    /** True when `url` belongs to the PWA (same scheme, host and port); everything else opens in the browser. */
    fun isInApp(url: String, appUrl: String): Boolean {
        val target = runCatching { URI(url) }.getOrNull() ?: return false
        val app = runCatching { URI(appUrl) }.getOrNull() ?: return false
        fun port(u: URI) = if (u.port != -1) u.port else if (u.scheme.equals("https", true)) 443 else 80
        return target.scheme.equals(app.scheme, true) &&
            target.host.equals(app.host, true) &&
            port(target) == port(app)
    }

    /**
     * True when `url` points at the PWA's host but not exactly its origin (other scheme or port).
     * Such links must never leave the app: the PWA installed from Chrome claims that host, and
     * handing them to Android would open it instead of this app.
     */
    fun isAppHost(url: String, appUrl: String): Boolean {
        val target = runCatching { URI(url) }.getOrNull() ?: return false
        val app = runCatching { URI(appUrl) }.getOrNull() ?: return false
        return target.host != null && target.host.equals(app.host, true)
    }

    /** `czyzyk://auth/callback?code=…` – where Supabase returns after Google sign-in in the browser. */
    fun isAuthCallback(link: String): Boolean {
        val uri = runCatching { URI(link) }.getOrNull() ?: return false
        return uri.scheme == "czyzyk" && uri.host == "auth" && uri.path == "/callback"
    }

    /**
     * The PWA address that finishes the sign-in: the callback's query (code, or error
     * details) on the PWA root, where supabase-js exchanges the code using the PKCE
     * verifier stored in this WebView. Only known parameters are passed on.
     */
    fun authCallbackTarget(link: String, appUrl: String): String? {
        if (!isAuthCallback(link)) return null
        val query = runCatching { URI(link).rawQuery }.getOrNull() ?: return null
        val allowed = setOf("code", "error", "error_code", "error_description")
        val kept = query.split("&").filter { part ->
            val name = URLDecoder.decode(part.substringBefore("="), "UTF-8")
            name in allowed && part.contains("=")
        }
        if (kept.isEmpty()) return null
        return "$appUrl/?${kept.joinToString("&")}"
    }
}
