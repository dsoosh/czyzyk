package pl.czyzyk.app.web

import android.os.Handler
import android.os.Looper
import android.webkit.JavascriptInterface

/**
 * `window.CzyzykAndroid` in the PWA. Exposes no data and performs no action other than
 * opening the native phone screen; the WebView only loads pages from the PWA's origin.
 */
class AppBridge(private val onOpenPhoneSettings: () -> Unit) {
    private val main = Handler(Looper.getMainLooper())

    @JavascriptInterface
    fun openPhoneSettings() {
        main.post(onOpenPhoneSettings)
    }

    companion object {
        const val NAME = "CzyzykAndroid"
    }
}
