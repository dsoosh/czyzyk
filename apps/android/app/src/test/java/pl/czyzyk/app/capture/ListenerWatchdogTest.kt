package pl.czyzyk.app.capture

import android.content.ComponentName
import android.content.Context
import android.content.pm.PackageManager
import android.provider.Settings
import androidx.test.core.app.ApplicationProvider
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class ListenerWatchdogTest {
    private val context = ApplicationProvider.getApplicationContext<Context>()
    private val component = ComponentName(context, CaptureService::class.java)

    private fun grantAccess() {
        Settings.Secure.putString(context.contentResolver, "enabled_notification_listeners", component.flattenToString())
    }

    @After
    fun reset() {
        ListenerWatchdog.connected = false
    }

    @Test
    fun doesNothingWithoutAccessOrWhenConnected() {
        // An explicit empty value: NotificationManagerCompat caches the last non-null one across tests.
        Settings.Secure.putString(context.contentResolver, "enabled_notification_listeners", "")
        assertFalse(ListenerWatchdog.ensureBound(context))
        grantAccess()
        ListenerWatchdog.connected = true
        assertFalse(ListenerWatchdog.ensureBound(context))
    }

    @Test
    fun renewsTheBindingWhenTheReaderIsNotConnectedAndKeepsItEnabled() {
        grantAccess()
        assertTrue(ListenerWatchdog.ensureBound(context))
        val state = context.packageManager.getComponentEnabledSetting(component)
        assertTrue(state == PackageManager.COMPONENT_ENABLED_STATE_ENABLED || state == PackageManager.COMPONENT_ENABLED_STATE_DEFAULT)
        assertEquals(true, ListenerWatchdog.hasAccess(context))
    }
}
