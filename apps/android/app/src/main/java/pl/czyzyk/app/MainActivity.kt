package pl.czyzyk.app

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.os.PowerManager
import android.provider.OpenableColumns
import android.provider.Settings
import android.view.ViewGroup
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.IntentCompat
import androidx.lifecycle.compose.LifecycleResumeEffect
import com.google.mlkit.vision.codescanner.GmsBarcodeScanning
import pl.czyzyk.app.pairing.PairingLink
import pl.czyzyk.app.pairing.SecureStore
import pl.czyzyk.app.update.ApkInstaller
import pl.czyzyk.app.update.Updates
import pl.czyzyk.app.web.PwaWebView
import pl.czyzyk.app.web.SharedChat
import pl.czyzyk.app.web.SharedChatException
import pl.czyzyk.app.web.SharedChatReader
import pl.czyzyk.app.web.WebRules
import pl.czyzyk.app.work.Deps
import pl.czyzyk.app.work.SyncInterval
import pl.czyzyk.app.work.Work
import java.text.DateFormat
import java.util.Date
import java.util.concurrent.atomic.AtomicReference
import kotlin.concurrent.thread

/** Which screen the activity shows: the hosted PWA, or the native phone screen. */
private enum class Screen { Web, Phone }

class MainActivity : ComponentActivity() {

    private var refreshTick by mutableIntStateOf(0)
    private var screen by mutableStateOf(Screen.Phone)
    private var appUrl by mutableStateOf<String?>(null)
    private var loadError by mutableStateOf(false)
    private lateinit var web: PwaWebView
    private var fileCallback: ValueCallback<Array<Uri>>? = null
    // Read by the JS bridge on a binder thread.
    private val sharedChat = AtomicReference<SharedChat?>(null)
    private var update by mutableStateOf<Updates.Outcome.Ready?>(null)
    private var updateDialogDismissed by mutableStateOf(false)
    private var checkingUpdate by mutableStateOf(false)

    // <input type="file"> in the PWA (e.g. Admin → Import of a chat export).
    private val pickFiles = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        fileCallback?.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result.resultCode, result.data))
        fileCallback = null
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        appUrl = Deps.state(this).appUrl
        screen = if (appUrl != null) Screen.Web else Screen.Phone
        web = PwaWebView(
            this,
            appUrl = { appUrl },
            onOpenPhoneSettings = { screen = Screen.Phone },
            takeSharedChat = { sharedChat.getAndSet(null)?.toJson() },
            onLoadError = { loadError = it },
            onFileChooser = { callback, params ->
                fileCallback?.onReceiveValue(null)
                fileCallback = callback
                try {
                    pickFiles.launch(params.createIntent())
                    true
                } catch (_: ActivityNotFoundException) {
                    fileCallback = null
                    false
                }
            },
        )
        handleIntent(intent)
        if (Deps.updatesEnabled()) Work.scheduleUpdateCheck(this)
        setContent { Root() }
    }

    override fun onResume() {
        super.onResume()
        if (!Deps.updatesEnabled()) return
        update = Updates.ready(Deps.state(this), Updates.dir(this), Deps.versionCode())
        if (Updates.shouldCheckOnOpen(Deps.state(this))) checkForUpdate(manual = false)
    }

    /** Reads the latest release and downloads a newer APK off the main thread. */
    private fun checkForUpdate(manual: Boolean) {
        if (checkingUpdate) return
        checkingUpdate = true
        val state = Deps.state(this)
        val dir = Updates.dir(this)
        thread(name = "update-check") {
            val outcome = Updates.prepare(state, Deps.updater(), dir, Deps.versionCode())
            runOnUiThread {
                checkingUpdate = false
                refreshTick++
                update = outcome as? Updates.Outcome.Ready ?: Updates.ready(state, dir, Deps.versionCode())
                if (outcome is Updates.Outcome.Ready && manual) updateDialogDismissed = false
                if (manual) {
                    val message = when (outcome) {
                        Updates.Outcome.UpToDate -> "Masz najnowszą wersję."
                        Updates.Outcome.Unavailable -> "Nie udało się sprawdzić aktualizacji."
                        is Updates.Outcome.Failed -> "Nie udało się pobrać aktualizacji."
                        is Updates.Outcome.Ready -> null
                    }
                    message?.let { Toast.makeText(this, it, Toast.LENGTH_SHORT).show() }
                }
            }
        }
    }

    private fun installUpdate() {
        val ready = update ?: return
        if (!ApkInstaller.allowed(this)) {
            Toast.makeText(this, "Zezwól Czyżykowi na instalowanie aplikacji, potem wróć i stuknij „Zainstaluj”.", Toast.LENGTH_LONG).show()
            startActivity(Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:$packageName")))
            return
        }
        val state = Deps.state(this)
        val dir = Updates.dir(this)
        thread(name = "update-install") {
            val started = runCatching {
                if (!Updates.verify(ready, state, dir)) return@runCatching false
                Deps.install(this, ready.apk, true)
                true
            }.getOrDefault(false)
            runOnUiThread {
                if (!started) {
                    update = null
                    Toast.makeText(this, "Nie udało się zainstalować aktualizacji. Spróbuj ponownie później.", Toast.LENGTH_LONG).show()
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleIntent(intent)
    }

    override fun onDestroy() {
        web.view.destroy()
        super.onDestroy()
    }

    @Composable
    private fun Root() {
        update?.takeUnless { updateDialogDismissed }?.let { ready ->
            UpdateDialog(
                versionName = ready.update.versionName,
                onInstall = {
                    updateDialogDismissed = true
                    installUpdate()
                },
                onLater = { updateDialogDismissed = true },
            )
        }
        when (screen) {
            Screen.Web -> {
                BackHandler {
                    if (web.view.canGoBack()) web.view.goBack() else finish()
                }
                WebScreen(web, loadError, onPhoneSettings = { screen = Screen.Phone })
            }
            Screen.Phone -> {
                BackHandler(enabled = appUrl != null) { screen = Screen.Web }
                CzyzykApp(
                    refreshTick = refreshTick,
                    onPairLink = ::pairFromLink,
                    appUrl = appUrl,
                    onSaveAppUrl = ::saveAppUrl,
                    onOpenApp = { screen = Screen.Web },
                    updates = if (Deps.updatesEnabled()) {
                        UpdatesUi(update?.update?.versionName, checkingUpdate, { checkForUpdate(manual = true) }, ::installUpdate)
                    } else {
                        null
                    },
                )
            }
        }
    }

    private fun handleIntent(intent: Intent?) {
        if (intent?.action == Intent.ACTION_SEND || intent?.action == Intent.ACTION_SEND_MULTIPLE) {
            receiveSharedExport(intent)
            return
        }
        val link = intent?.data?.toString() ?: return
        if (WebRules.isAuthCallback(link)) {
            // Google sign-in finished in the browser: complete it in the WebView (PKCE verifier lives there).
            val target = appUrl?.let { WebRules.authCallbackTarget(link, it) } ?: return
            screen = Screen.Web
            web.load(target)
            return
        }
        pairFromLink(link)
    }

    /**
     * A WhatsApp chat export shared to the app: the chat text is read off the main thread
     * (a ZIP with media can be large), then Admin → Import opens and takes it over the bridge.
     */
    private fun receiveSharedExport(intent: Intent) {
        val app = appUrl
        if (app == null) {
            screen = Screen.Phone
            Toast.makeText(this, "Najpierw ustaw adres aplikacji Czyżyk.", Toast.LENGTH_LONG).show()
            return
        }
        val items = sharedItems(intent)
        val text = intent.getStringExtra(Intent.EXTRA_TEXT)
        Toast.makeText(this, "Wczytuję eksport czatu…", Toast.LENGTH_SHORT).show()
        thread(name = "shared-chat") {
            val result = runCatching {
                if (items.isEmpty() && !text.isNullOrBlank()) SharedChat("czat.txt", text) else SharedChatReader.read(items)
            }
            runOnUiThread {
                result.onSuccess {
                    sharedChat.set(it)
                    screen = Screen.Web
                    web.load("$app/admin/import")
                }.onFailure {
                    val message = (it as? SharedChatException)?.message ?: "Nie udało się odczytać eksportu."
                    Toast.makeText(this, message, Toast.LENGTH_LONG).show()
                }
            }
        }
    }

    private fun sharedItems(intent: Intent): List<SharedChatReader.Item> {
        val uris = if (intent.action == Intent.ACTION_SEND_MULTIPLE) {
            IntentCompat.getParcelableArrayListExtra(intent, Intent.EXTRA_STREAM, Uri::class.java).orEmpty()
        } else {
            listOfNotNull(IntentCompat.getParcelableExtra(intent, Intent.EXTRA_STREAM, Uri::class.java))
        }
        return uris.map { uri ->
            val name = contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)
                ?.use { c -> if (c.moveToFirst()) c.getString(0) else null }
                ?: uri.lastPathSegment
                ?: "czat"
            SharedChatReader.Item(name, contentResolver.getType(uri)) {
                contentResolver.openInputStream(uri) ?: throw SharedChatException("Nie udało się otworzyć pliku.")
            }
        }
    }

    /** Typed PWA address; returns false when it is not a valid https address. */
    private fun saveAppUrl(input: String): Boolean {
        val url = WebRules.normalizeAppUrl(input)
        if (url == null) {
            Toast.makeText(this, "Podaj adres https aplikacji, np. czyzyk.up.railway.app", Toast.LENGTH_LONG).show()
            return false
        }
        Deps.state(this).appUrl = url
        appUrl = url
        screen = Screen.Web
        return true
    }

    /** Accepts `czyzyk://pair?server=…&token=…[&app=…]` from a tapped link, a QR code or a pasted text. */
    private fun pairFromLink(link: String): Boolean {
        val pairing = PairingLink.parse(link)
        if (pairing == null) {
            Toast.makeText(this, "To nie jest poprawny link parowania", Toast.LENGTH_LONG).show()
            return false
        }
        Deps.store(this).pair(pairing)
        PairingLink.appUrl(link)?.let {
            Deps.state(this).appUrl = it
            appUrl = it
        }
        Work.schedulePeriodicSync(this)
        Work.enqueueSync(this)
        Work.enqueueSend(this)
        refreshTick++
        Toast.makeText(this, "Połączono z serwerem", Toast.LENGTH_SHORT).show()
        return true
    }
}

@Composable
private fun UpdateDialog(versionName: String, onInstall: () -> Unit, onLater: () -> Unit) {
    MaterialTheme {
        AlertDialog(
            onDismissRequest = onLater,
            title = { Text("Nowa wersja Czyżyka") },
            text = { Text("Wersja $versionName jest pobrana i gotowa do instalacji. Aplikacja na chwilę się zamknie.") },
            confirmButton = { Button(onClick = onInstall) { Text("Zainstaluj") } },
            dismissButton = { TextButton(onClick = onLater) { Text("Później") } },
        )
    }
}

/** Update state for the phone screen; null when this build does not update itself (debug). */
class UpdatesUi(
    val readyVersion: String?,
    val checking: Boolean,
    val onCheck: () -> Unit,
    val onInstall: () -> Unit,
)

/** The hosted PWA, with a fallback when it cannot be loaded (offline, wrong address). */
@Composable
private fun WebScreen(web: PwaWebView, loadError: Boolean, onPhoneSettings: () -> Unit) {
    Box(Modifier.fillMaxSize().background(Color(0xFFF5EAD8)).safeDrawingPadding()) {
        AndroidView(
            factory = {
                (web.view.parent as? ViewGroup)?.removeView(web.view)
                web.view
            },
            update = { web.ensureLoaded() },
            modifier = Modifier.fillMaxSize(),
        )
        if (loadError) {
            MaterialTheme {
                Surface(Modifier.fillMaxSize()) {
                    Column(
                        Modifier.padding(24.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp, Alignment.CenterVertically),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        Text("Nie udało się otworzyć aplikacji", style = MaterialTheme.typography.titleLarge)
                        Text("Sprawdź połączenie z internetem albo adres aplikacji w ustawieniach telefonu.")
                        Button(onClick = { web.reload() }) { Text("Spróbuj ponownie") }
                        OutlinedButton(onClick = onPhoneSettings) { Text("Ustawienia telefonu") }
                    }
                }
            }
        }
    }
}

private data class Status(
    val pairing: SecureStore.State,
    val server: String?,
    val notificationAccess: Boolean,
    val batteryUnrestricted: Boolean,
    val queueSize: Int,
    val pendingAttachments: Int,
    val lastDeliveredAt: Long,
    val trackedGroups: Int,
    val syncInterval: SyncInterval,
    val trackedFetchedAt: Long,
    val installAllowed: Boolean,
    val lastUpdateCheckAt: Long,
)

private fun readStatus(context: Context): Status {
    val store = Deps.store(context)
    val state = Deps.state(context)
    val power = context.getSystemService(PowerManager::class.java)
    return Status(
        pairing = store.state,
        server = store.pairing?.serverUrl,
        notificationAccess = context.packageName in NotificationManagerCompat.getEnabledListenerPackages(context),
        batteryUnrestricted = power.isIgnoringBatteryOptimizations(context.packageName),
        queueSize = Deps.queue(context).size(),
        pendingAttachments = state.pendingAttachments,
        lastDeliveredAt = state.lastDeliveredAt,
        trackedGroups = state.trackedGroups.size,
        syncInterval = state.syncInterval,
        trackedFetchedAt = state.trackedFetchedAt,
        installAllowed = ApkInstaller.allowed(context),
        lastUpdateCheckAt = state.lastUpdateCheckAt,
    )
}

private val Ok = Color(0xFF3F6212)
private val Bad = Color(0xFFB91C1C)

@Composable
fun CzyzykApp(
    refreshTick: Int,
    onPairLink: (String) -> Boolean,
    appUrl: String?,
    onSaveAppUrl: (String) -> Boolean,
    onOpenApp: () -> Unit,
    updates: UpdatesUi? = null,
) {
    val context = LocalContext.current
    var status by remember { mutableStateOf(readStatus(context)) }
    LifecycleResumeEffect(refreshTick) {
        status = readStatus(context)
        onPauseOrDispose { }
    }

    MaterialTheme {
        Surface(modifier = Modifier.fillMaxSize()) {
            Column(
                modifier = Modifier.safeDrawingPadding().verticalScroll(rememberScrollState()).padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                Text(AppInfo.NAME, style = MaterialTheme.typography.headlineMedium)
                Text(AppInfo.TAGLINE, style = MaterialTheme.typography.bodyMedium)
                AppCard(appUrl, onSaveAppUrl, onOpenApp)
                PairingCard(status, onPairLink)
                PermissionsCard(status)
                QueueCard(status)
                SyncCard(status) { status = readStatus(context) }
                UpdatesCard(status, updates)
                TipsCard()
            }
        }
    }
}

@Composable
private fun AppCard(appUrl: String?, onSave: (String) -> Boolean, onOpen: () -> Unit) {
    var typed by remember(appUrl) { mutableStateOf(appUrl.orEmpty()) }
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Aplikacja Czyżyk", style = MaterialTheme.typography.titleMedium)
            Text(
                "Adres aplikacji (PWA) otwieranej w tym telefonie. Link parowania podaje go sam; możesz też wpisać go ręcznie.",
                style = MaterialTheme.typography.bodySmall,
            )
            OutlinedTextField(
                value = typed,
                onValueChange = { typed = it },
                label = { Text("Adres aplikacji") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(onClick = { onSave(typed) }, enabled = typed.isNotBlank() && typed != appUrl) { Text("Zapisz adres") }
                if (appUrl != null) Button(onClick = onOpen) { Text("Otwórz aplikację") }
            }
        }
    }
}

@Composable
private fun StatusLine(ok: Boolean, text: String) {
    Text(text, color = if (ok) Ok else Bad, style = MaterialTheme.typography.titleMedium)
}

@Composable
private fun PairingCard(status: Status, onPairLink: (String) -> Boolean) {
    val context = LocalContext.current
    var pasted by remember { mutableStateOf("") }
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            when (status.pairing) {
                SecureStore.State.PAIRED -> StatusLine(true, "Połączono z serwerem")
                SecureStore.State.REVOKED -> StatusLine(false, "Urządzenie odłączone – sparuj ponownie")
                SecureStore.State.NOT_PAIRED -> StatusLine(false, "Nie sparowano")
            }
            status.server?.let { Text(it, style = MaterialTheme.typography.bodySmall) }
            Text("W aplikacji Czyżyk (PWA): Admin → Urządzenia → Dodaj telefon.", style = MaterialTheme.typography.bodySmall)
            Button(onClick = {
                GmsBarcodeScanning.getClient(context).startScan()
                    .addOnSuccessListener { code -> code.rawValue?.let(onPairLink) }
            }) { Text("Zeskanuj kod QR") }
            OutlinedTextField(
                value = pasted,
                onValueChange = { pasted = it },
                label = { Text("…albo wklej link parowania") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            OutlinedButton(onClick = { if (onPairLink(pasted)) pasted = "" }, enabled = pasted.isNotBlank()) {
                Text("Połącz")
            }
        }
    }
}

@Composable
private fun PermissionsCard(status: Status) {
    val context = LocalContext.current
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            StatusLine(status.notificationAccess, if (status.notificationAccess) "Dostęp do powiadomień włączony" else "Brak dostępu do powiadomień")
            if (!status.notificationAccess) {
                Button(onClick = { context.startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)) }) {
                    Text("Włącz dostęp do powiadomień")
                }
            }
            StatusLine(
                status.batteryUnrestricted,
                if (status.batteryUnrestricted) "Optymalizacja baterii wyłączona" else "Optymalizacja baterii może zatrzymywać czytnik",
            )
            if (!status.batteryUnrestricted) {
                Button(onClick = {
                    context.startActivity(
                        Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:${context.packageName}")),
                    )
                }) { Text("Wyłącz optymalizację baterii") }
            }
        }
    }
}

@Composable
private fun QueueCard(status: Status) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("Śledzone grupy:")
                Spacer(Modifier.width(8.dp))
                Text("${status.trackedGroups}")
            }
            Text("Wiadomości w kolejce: ${status.queueSize}")
            Text("Zaległe załączniki: ${status.pendingAttachments}")
            Text("Ostatnia wysyłka: " + formatTime(status.lastDeliveredAt))
        }
    }
}

@Composable
private fun SyncCard(status: Status, onChanged: () -> Unit) {
    val context = LocalContext.current
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Synchronizacja", style = MaterialTheme.typography.titleMedium)
            Text(
                "Jak często telefon pobiera listę śledzonych grup. Wiadomości są wysyłane od razu – interwał decyduje " +
                    "tylko o tym, jak szybko telefon zauważy zmiany grup w panelu admina.",
                style = MaterialTheme.typography.bodySmall,
            )
            Column(Modifier.selectableGroup()) {
                SyncInterval.entries.forEach { interval ->
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.fillMaxWidth().selectable(
                            selected = interval == status.syncInterval,
                            role = Role.RadioButton,
                            onClick = {
                                Deps.state(context).syncInterval = interval
                                Work.schedulePeriodicSync(context)
                                onChanged()
                            },
                        ),
                    ) {
                        RadioButton(selected = interval == status.syncInterval, onClick = null)
                        Spacer(Modifier.width(8.dp))
                        Text("co ${interval.label}")
                    }
                }
            }
            Text("Ostatnie odświeżenie: " + formatTime(status.trackedFetchedAt))
            OutlinedButton(
                onClick = {
                    Work.enqueueSync(context)
                    Toast.makeText(context, "Odświeżam listę grup", Toast.LENGTH_SHORT).show()
                },
                enabled = status.pairing == SecureStore.State.PAIRED,
            ) { Text("Odśwież teraz") }
        }
    }
}

private fun formatTime(millis: Long): String =
    if (millis == 0L) "jeszcze nie było"
    else DateFormat.getDateTimeInstance(DateFormat.SHORT, DateFormat.SHORT).format(Date(millis))

@Composable
private fun UpdatesCard(status: Status, updates: UpdatesUi?) {
    val context = LocalContext.current
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Aktualizacje", style = MaterialTheme.typography.titleMedium)
            Text("Zainstalowana wersja: ${BuildConfig.VERSION_NAME}")
            if (updates == null) {
                Text(
                    "Ta wersja (debug) nie aktualizuje się sama. Zainstaluj wydanie z GitHuba, żeby dostawać aktualizacje automatycznie.",
                    style = MaterialTheme.typography.bodySmall,
                )
                return@Column
            }
            Text(
                "Czyżyk raz dziennie sprawdza nowe wydanie na GitHubie, pobiera je i instaluje – bez pytania, gdy Android na to pozwala.",
                style = MaterialTheme.typography.bodySmall,
            )
            Text("Ostatnie sprawdzenie: " + formatTime(status.lastUpdateCheckAt))
            if (!status.installAllowed) {
                StatusLine(false, "Brak zgody na instalowanie aktualizacji")
                Button(onClick = {
                    context.startActivity(
                        Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:${context.packageName}")),
                    )
                }) { Text("Zezwól na instalowanie") }
            }
            updates.readyVersion?.let { version ->
                StatusLine(true, "Gotowa do instalacji: $version")
                Button(onClick = updates.onInstall) { Text("Zainstaluj") }
            }
            OutlinedButton(onClick = updates.onCheck, enabled = !updates.checking) {
                Text(if (updates.checking) "Sprawdzam…" else "Sprawdź teraz")
            }
        }
    }
}

@Composable
private fun TipsCard() {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text("Ważne", style = MaterialTheme.typography.titleMedium)
            Text("• Nie wyciszaj grup przedszkolnych – ustaw im cichy dźwięk powiadomień. Wyciszone grupy nie pokazują powiadomień, więc ich wiadomości nie trafią do aplikacji.")
            Text("• Wiadomości z czatu otwartego na ekranie nie generują powiadomień; uzupełni je eksport czatu.")
            Text("• Na Xiaomi i Samsungu zezwól też na autostart i działanie w tle w ustawieniach baterii.")
        }
    }
}

object AppInfo {
    const val NAME = "Czyżyk"
    const val TAGLINE = "Źródło danych dla asystenta przedszkolnego"
}
