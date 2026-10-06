package pl.czyzyk.app.work

import android.content.Context
import pl.czyzyk.app.AppState
import pl.czyzyk.app.BuildConfig
import pl.czyzyk.app.net.HttpIngestApi
import pl.czyzyk.app.net.IngestApi
import pl.czyzyk.app.pairing.SecureStore
import pl.czyzyk.app.queue.MessageQueue
import pl.czyzyk.app.update.ApkInstaller
import pl.czyzyk.app.update.ReleaseSource
import pl.czyzyk.app.update.Updater
import java.io.File

/** Wiring for workers and the listener; tests replace the factories. */
object Deps {
    var api: () -> IngestApi = { HttpIngestApi() }
    var store: (Context) -> SecureStore = { SecureStore.get(it) }
    var queue: (Context) -> MessageQueue = { MessageQueue.get(it) }
    var state: (Context) -> AppState = { AppState.get(it) }

    // App updates from GitHub releases.
    var updatesEnabled: () -> Boolean = { BuildConfig.UPDATES_ENABLED }
    var versionCode: () -> Long = { BuildConfig.VERSION_CODE.toLong() }
    var updater: () -> Updater = { Updater(ReleaseSource.github(BuildConfig.UPDATE_REPO)) }
    var canInstallSilently: (Context) -> Boolean = { ApkInstaller.canTrySilently(it) }
    var install: (Context, File, Boolean) -> Unit = { context, apk, interactive -> ApkInstaller.install(context, apk, interactive) }
}
