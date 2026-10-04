package pl.czyzyk.app

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.os.PowerManager
import android.provider.Settings
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
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
import androidx.compose.ui.unit.dp
import androidx.core.app.NotificationManagerCompat
import androidx.lifecycle.compose.LifecycleResumeEffect
import com.google.mlkit.vision.codescanner.GmsBarcodeScanning
import pl.czyzyk.app.pairing.PairingLink
import pl.czyzyk.app.pairing.SecureStore
import pl.czyzyk.app.work.Deps
import pl.czyzyk.app.work.Work
import java.text.DateFormat
import java.util.Date

class MainActivity : ComponentActivity() {

    private var refreshTick by mutableIntStateOf(0)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        handlePairingIntent(intent)
        setContent { CzyzykApp(refreshTick, ::pairFromLink) }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handlePairingIntent(intent)
    }

    private fun handlePairingIntent(intent: Intent?) {
        intent?.data?.toString()?.let(::pairFromLink)
    }

    /** Accepts `czyzyk://pair?server=…&token=…` from a tapped link, a QR code or a pasted text. */
    private fun pairFromLink(link: String): Boolean {
        val pairing = PairingLink.parse(link)
        if (pairing == null) {
            Toast.makeText(this, "To nie jest poprawny link parowania", Toast.LENGTH_LONG).show()
            return false
        }
        Deps.store(this).pair(pairing)
        Work.schedulePeriodicSync(this)
        Work.enqueueSync(this)
        Work.enqueueSend(this)
        refreshTick++
        Toast.makeText(this, "Połączono z serwerem", Toast.LENGTH_SHORT).show()
        return true
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
    )
}

private val Ok = Color(0xFF3F6212)
private val Bad = Color(0xFFB91C1C)

@Composable
fun CzyzykApp(refreshTick: Int, onPairLink: (String) -> Boolean) {
    val context = LocalContext.current
    var status by remember { mutableStateOf(readStatus(context)) }
    LifecycleResumeEffect(refreshTick) {
        status = readStatus(context)
        onPauseOrDispose { }
    }

    MaterialTheme {
        Surface(modifier = Modifier.fillMaxSize()) {
            Column(
                modifier = Modifier.verticalScroll(rememberScrollState()).padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                Text(AppInfo.NAME, style = MaterialTheme.typography.headlineMedium)
                Text(AppInfo.TAGLINE, style = MaterialTheme.typography.bodyMedium)
                PairingCard(status, onPairLink)
                PermissionsCard(status)
                QueueCard(status)
                TipsCard()
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
            Text(
                "Ostatnia wysyłka: " + if (status.lastDeliveredAt == 0L) "jeszcze nie było"
                else DateFormat.getDateTimeInstance(DateFormat.SHORT, DateFormat.SHORT).format(Date(status.lastDeliveredAt)),
            )
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
