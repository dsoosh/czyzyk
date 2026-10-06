package pl.czyzyk.app.capture

import java.text.Normalizer

/**
 * One spelling per group name, the same rule as normalizeGroupName in packages/shared and
 * normalize_group_name in migration 0012: NFC, no invisible formatting characters (Android
 * wraps names in bidi isolates U+2068/U+2069), single spaces, trimmed.
 */
object GroupNames {
    private val FORMAT_CHARS = Regex("[\\u00AD\\u061C\\u180E\\u200B-\\u200F\\u202A-\\u202E\\u2060-\\u2069\\uFEFF]")
    private val SPACES = Regex("[\\s\\u00A0]+")

    fun normalize(name: String): String =
        Normalizer.normalize(name, Normalizer.Form.NFC).replace(FORMAT_CHARS, "").replace(SPACES, " ").trim()
}
