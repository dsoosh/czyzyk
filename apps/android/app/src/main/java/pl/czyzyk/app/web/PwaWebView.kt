package pl.czyzyk.app.web

import android.annotation.SuppressLint
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.net.Uri
import android.view.ViewGroup
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient

/**
 * One WebView for the activity's lifetime, so switching to the phone screen and back
 * keeps the PWA's state. Pages outside the PWA (Google sign-in, links in messages) open
 * in the browser.
 */
@SuppressLint("SetJavaScriptEnabled")
class PwaWebView(
    context: Context,
    private val appUrl: () -> String?,
    onOpenPhoneSettings: () -> Unit,
    private val onLoadError: (Boolean) -> Unit,
    private val onFileChooser: (ValueCallback<Array<Uri>>, WebChromeClient.FileChooserParams) -> Boolean,
) {
    val view: WebView = WebView(context).apply {
        layoutParams = ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.allowFileAccess = false
        settings.allowContentAccess = false
        addJavascriptInterface(AppBridge(onOpenPhoneSettings), AppBridge.NAME)
        webViewClient = Client()
        webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(
                webView: WebView,
                filePathCallback: ValueCallback<Array<Uri>>,
                fileChooserParams: FileChooserParams,
            ): Boolean = onFileChooser(filePathCallback, fileChooserParams)
        }
    }

    private var loadedFor: String? = null

    /** Loads the PWA once for the current address (again when the address changes). */
    fun ensureLoaded() {
        val app = appUrl() ?: return
        if (loadedFor == app) return
        loadedFor = app
        load(app)
    }

    /** Loads a PWA page (e.g. the sign-in callback); counts as loaded for the current address. */
    fun load(url: String) {
        loadedFor = appUrl()
        onLoadError(false)
        view.loadUrl(url)
    }

    fun reload() {
        onLoadError(false)
        view.reload()
    }

    private inner class Client : WebViewClient() {
        override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
            val url = request.url.toString()
            val app = appUrl() ?: return true
            if (WebRules.isInApp(url, app)) return false
            openOutside(view.context, request.url)
            return true
        }

        override fun onPageStarted(view: WebView, url: String?, favicon: Bitmap?) {
            onLoadError(false)
        }

        override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
            if (request.isForMainFrame) onLoadError(true)
        }
    }

    private fun openOutside(context: Context, uri: Uri) {
        try {
            context.startActivity(Intent(Intent.ACTION_VIEW, uri).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        } catch (_: ActivityNotFoundException) {
            // No app can open it (e.g. an unusual scheme in a message): ignore.
        }
    }
}
