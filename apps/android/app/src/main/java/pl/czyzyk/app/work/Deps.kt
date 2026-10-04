package pl.czyzyk.app.work

import android.content.Context
import pl.czyzyk.app.AppState
import pl.czyzyk.app.net.HttpIngestApi
import pl.czyzyk.app.net.IngestApi
import pl.czyzyk.app.pairing.SecureStore
import pl.czyzyk.app.queue.MessageQueue

/** Wiring for workers and the listener; tests replace the factories. */
object Deps {
    var api: () -> IngestApi = { HttpIngestApi() }
    var store: (Context) -> SecureStore = { SecureStore.get(it) }
    var queue: (Context) -> MessageQueue = { MessageQueue.get(it) }
    var state: (Context) -> AppState = { AppState.get(it) }
}
