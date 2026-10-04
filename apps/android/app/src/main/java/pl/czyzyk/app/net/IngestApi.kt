package pl.czyzyk.app.net

import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import pl.czyzyk.app.capture.CapturedMessage
import pl.czyzyk.app.pairing.Pairing
import java.io.IOException
import java.time.Instant
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.concurrent.TimeUnit

/** Outcome of one upload, mapped from the HTTP status codes of the ingest endpoints. */
sealed interface SendResult {
    /** 201 created or 200 duplicate – the server has the message. */
    data object Delivered : SendResult
    /** 400 or 422 (group no longer tracked) – retrying cannot help; drop it. */
    data class Rejected(val status: Int) : SendResult
    /** 401 – the device token was revoked. */
    data object Unauthorized : SendResult
    /** 429, 5xx or network error – try again later. */
    data class Retry(val reason: String) : SendResult
}

data class IngestConfig(val trackedGroups: Set<String>, val ttlSeconds: Long)

interface IngestApi {
    fun sendNotification(pairing: Pairing, message: CapturedMessage): SendResult
    /** Returns null when the request failed; throws [UnauthorizedException] on 401. */
    fun fetchConfig(pairing: Pairing): IngestConfig?
    fun reportGroups(pairing: Pairing, names: Collection<String>): SendResult
}

class UnauthorizedException : IOException("device token rejected")

class HttpIngestApi(
    private val client: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .build(),
) : IngestApi {
    private val json = "application/json; charset=utf-8".toMediaType()
    private val zone = ZoneId.of("Europe/Warsaw")

    private fun request(pairing: Pairing, path: String) =
        Request.Builder().url(pairing.serverUrl + path).header("Authorization", "Bearer ${pairing.token}")

    private fun post(pairing: Pairing, path: String, body: JSONObject): SendResult = try {
        client.newCall(request(pairing, path).post(body.toString().toRequestBody(json)).build()).execute().use { r ->
            when (r.code) {
                200, 201 -> SendResult.Delivered
                401 -> SendResult.Unauthorized
                400, 422 -> SendResult.Rejected(r.code)
                else -> SendResult.Retry("http ${r.code}")
            }
        }
    } catch (e: IOException) {
        SendResult.Retry(e.javaClass.simpleName)
    }

    override fun sendNotification(pairing: Pairing, message: CapturedMessage): SendResult {
        val sentAt = OffsetDateTime.ofInstant(Instant.ofEpochMilli(message.sentAtMillis), zone)
        return post(
            pairing,
            "/ingest/notification",
            JSONObject()
                .put("idempotency_key", message.idempotencyKey)
                .put("group_name", message.groupName)
                .put("author", message.author)
                .put("text", message.text)
                .put("sent_at", sentAt.format(DateTimeFormatter.ISO_OFFSET_DATE_TIME))
                .put("has_attachment", message.hasAttachment)
                .put("wa_package", message.waPackage),
        )
    }

    override fun reportGroups(pairing: Pairing, names: Collection<String>): SendResult =
        post(pairing, "/ingest/seen-groups", JSONObject().put("names", JSONArray(names.toList())))

    override fun fetchConfig(pairing: Pairing): IngestConfig? = try {
        client.newCall(request(pairing, "/ingest/config").get().build()).execute().use { r ->
            if (r.code == 401) throw UnauthorizedException()
            if (!r.isSuccessful) return null
            val body = JSONObject(r.body?.string() ?: return null)
            val groups = body.getJSONArray("tracked_groups")
            IngestConfig(
                trackedGroups = (0 until groups.length()).map { groups.getString(it) }.toSet(),
                ttlSeconds = body.optLong("config_ttl_seconds", 900),
            )
        }
    } catch (e: UnauthorizedException) {
        throw e
    } catch (e: IOException) {
        null
    }
}
