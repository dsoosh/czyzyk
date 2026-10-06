package pl.czyzyk.app

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import pl.czyzyk.app.work.SyncInterval

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class AppStateTest {
    private val prefs = ApplicationProvider.getApplicationContext<Context>()
        .getSharedPreferences("test_app_state", Context.MODE_PRIVATE)
    private val state = AppState(prefs)

    @After
    fun tearDown() {
        prefs.edit().clear().commit()
    }

    @Test
    fun syncIntervalDefaultsTo15Minutes() {
        assertEquals(SyncInterval.MIN_15, state.syncInterval)
    }

    @Test
    fun chosenSyncIntervalIsStored() {
        state.syncInterval = SyncInterval.HOUR_3
        assertEquals(SyncInterval.HOUR_3, AppState(prefs).syncInterval)
    }

    @Test
    fun unknownStoredIntervalFallsBackToDefault() {
        prefs.edit().putLong("sync_interval_minutes", 7).commit()
        assertEquals(SyncInterval.DEFAULT, state.syncInterval)
    }

    @Test
    fun staleAfterServerTtlWithDefaultInterval() {
        state.saveTrackedGroups(setOf("Motylki"), ttlMillis = 15 * 60_000L, now = 0)
        assertFalse(state.trackedGroupsStale(now = 14 * 60_000L))
        assertTrue(state.trackedGroupsStale(now = 15 * 60_000L))
    }

    @Test
    fun longerIntervalDelaysStaleness() {
        state.syncInterval = SyncInterval.HOUR_6
        state.saveTrackedGroups(setOf("Motylki"), ttlMillis = 15 * 60_000L, now = 0)
        assertFalse(state.trackedGroupsStale(now = 5 * 60 * 60_000L))
        assertTrue(state.trackedGroupsStale(now = 6 * 60 * 60_000L))
    }
}
