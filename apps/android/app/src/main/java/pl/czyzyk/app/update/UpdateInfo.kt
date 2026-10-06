package pl.czyzyk.app.update

import org.json.JSONException
import org.json.JSONObject

/** One published release, as described by `version.json` next to the APK. */
data class UpdateInfo(
    val versionCode: Long,
    val versionName: String,
    val tag: String,
    val sha256: String,
    val size: Long,
) {
    companion object {
        const val MAX_APK_BYTES = 100L * 1024 * 1024
        private val TAG = Regex("^android-v[0-9]{1,10}$")
        private val SHA256 = Regex("^[0-9a-f]{64}$")

        /** Parses and validates `version.json`; null when anything is missing or out of range. */
        fun parse(json: String): UpdateInfo? = try {
            val o = JSONObject(json)
            UpdateInfo(
                versionCode = o.getLong("versionCode"),
                versionName = o.getString("versionName"),
                tag = o.getString("tag"),
                sha256 = o.getString("sha256").lowercase(),
                size = o.getLong("size"),
            ).takeIf {
                it.versionCode > 0 && it.versionName.length in 1..40 && TAG.matches(it.tag) &&
                    SHA256.matches(it.sha256) && it.size in 1..MAX_APK_BYTES
            }
        } catch (_: JSONException) {
            null
        }
    }
}

/** Where releases live: `https://github.com/<repo>`, overridable in tests. */
class ReleaseSource(private val base: String) {
    val manifestUrl: String get() = "$base/releases/latest/download/version.json"

    /** The APK URL is built from the repository and the validated tag, never taken from the file. */
    fun apkUrl(info: UpdateInfo): String = "$base/releases/download/${info.tag}/czyzyk.apk"

    companion object {
        fun github(repo: String) = ReleaseSource("https://github.com/$repo")
    }
}
