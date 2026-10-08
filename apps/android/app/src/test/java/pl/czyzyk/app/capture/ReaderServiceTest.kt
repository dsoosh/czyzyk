package pl.czyzyk.app.capture

import android.app.Application
import android.content.ComponentName
import android.content.Context
import android.provider.Settings
import androidx.test.core.app.ApplicationProvider
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import pl.czyzyk.app.AppState
import pl.czyzyk.app.work.Deps

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class ReaderServiceTest {
    private val context = ApplicationProvider.getApplicationContext<Application>()
    private lateinit var state: AppState

    @Before
    fun setUp() {
        state = AppState(context.getSharedPreferences("reader_test", Context.MODE_PRIVATE))
        Deps.state = { state }
        val reader = ComponentName(context, CaptureService::class.java).flattenToString()
        Settings.Secure.putString(context.contentResolver, "enabled_notification_listeners", reader)
    }

    @After
    fun tearDown() {
        context.getSharedPreferences("reader_test", Context.MODE_PRIVATE).edit().clear().commit()
        Deps.state = { AppState.get(it) }
    }

    @Test
    fun startsByDefaultWhenTheReaderHasAccess() {
        ReaderService.start(context)
        assertEquals(ReaderService::class.java.name, shadowOf(context).nextStartedService?.component?.className)
    }

    @Test
    fun staysOffWhenTheUserTurnedItOffOrWithoutAccess() {
        state.readerServiceEnabled = false
        ReaderService.start(context)
        assertNull(shadowOf(context).nextStartedService)

        state.readerServiceEnabled = true
        Settings.Secure.putString(context.contentResolver, "enabled_notification_listeners", "")
        ReaderService.start(context)
        assertNull(shadowOf(context).nextStartedService)
    }

    @Test
    fun runsInTheForegroundWithAQuietNotification() {
        val service = Robolectric.buildService(ReaderService::class.java).create().get()
        service.onStartCommand(null, 0, 1)
        val notification = shadowOf(service).lastForegroundNotification
        assertEquals("Czyżyk czyta powiadomienia", notification.extras.getString("android.title"))
    }
}
