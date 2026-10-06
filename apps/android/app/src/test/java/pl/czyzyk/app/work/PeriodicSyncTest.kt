package pl.czyzyk.app.work

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import androidx.work.Configuration
import androidx.work.WorkManager
import androidx.work.testing.SynchronousExecutor
import androidx.work.testing.WorkManagerTestInitHelper
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import pl.czyzyk.app.AppState

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class PeriodicSyncTest {
    private val context = ApplicationProvider.getApplicationContext<Context>()
    private lateinit var state: AppState

    @Before
    fun setUp() {
        WorkManagerTestInitHelper.initializeTestWorkManager(
            context,
            Configuration.Builder().setExecutor(SynchronousExecutor()).build(),
        )
        state = AppState(context.getSharedPreferences("test_periodic_state", Context.MODE_PRIVATE))
        Deps.state = { state }
    }

    @After
    fun tearDown() {
        context.getSharedPreferences("test_periodic_state", Context.MODE_PRIVATE).edit().clear().commit()
    }

    private fun scheduledIntervals(): List<Long> =
        WorkManager.getInstance(context).getWorkInfosForUniqueWork(Work.PERIODIC_SYNC).get()
            .filterNot { it.state.isFinished }
            .map { it.periodicityInfo!!.repeatIntervalMillis }

    @Test
    fun usesDefaultIntervalOf15Minutes() {
        Work.schedulePeriodicSync(context)
        assertEquals(listOf(15 * 60_000L), scheduledIntervals())
    }

    @Test
    fun changedIntervalUpdatesTheExistingWork() {
        Work.schedulePeriodicSync(context)
        state.syncInterval = SyncInterval.HOUR_3
        Work.schedulePeriodicSync(context)
        assertEquals(listOf(3 * 60 * 60_000L), scheduledIntervals())
    }

    @Test
    fun updateCheckRunsDailyAndKeepsAnExistingSchedule() {
        Work.scheduleUpdateCheck(context)
        Work.scheduleUpdateCheck(context)
        val infos = WorkManager.getInstance(context).getWorkInfosForUniqueWork(Work.PERIODIC_UPDATE).get()
            .filterNot { it.state.isFinished }
        assertEquals(listOf(24 * 60 * 60_000L), infos.map { it.periodicityInfo!!.repeatIntervalMillis })
    }
}
