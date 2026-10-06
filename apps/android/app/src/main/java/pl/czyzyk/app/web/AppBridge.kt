package pl.czyzyk.app.web

import android.os.Handler
import android.os.Looper
import android.webkit.JavascriptInterface

/**
 * `window.CzyzykAndroid` in the PWA: opens the native phone screen and hands over a chat
 * export the user shared to the app. The WebView only loads pages from the PWA's origin.
 */
class AppBridge(
    private val onOpenPhoneSettings: () -> Unit,
    private val takeSharedChatJson: () -> String?,
) {
    private val main = Handler(Looper.getMainLooper())

    @JavascriptInterface
    fun openPhoneSettings() {
        main.post(onOpenPhoneSettings)
    }

    /** A chat export shared to the app, as JSON {fileName, text}, handed over once (then null). */
    @JavascriptInterface
    fun takeSharedChat(): String? = takeSharedChatJson()

    companion object {
        const val NAME = "CzyzykAndroid"
    }
}
