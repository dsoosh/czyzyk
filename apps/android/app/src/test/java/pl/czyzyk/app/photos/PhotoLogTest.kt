package pl.czyzyk.app.photos

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class PhotoLogTest {
    private val context = ApplicationProvider.getApplicationContext<Context>()
    private val now = 1_791_388_920_000L

    @Test
    fun keepsTheFirstSightingOfANotice() {
        val log = PhotoLog(context, "notes.db")
        log.addNote(PhotoNote("k1", now, "k1", "Motylki"))
        log.addNote(PhotoNote("k1", now + 50_000, "k1", "Motylki"))
        log.addNote(PhotoNote("p1", now + 10_000, null, null))
        assertEquals(
            listOf(PhotoNote("k1", now, "k1", "Motylki"), PhotoNote("p1", now + 10_000, null, null)),
            log.notesBetween(now - 1, now + 60_000),
        )
        log.prune(now + PhotoLog.KEEP_MILLIS + 5_000)
        assertEquals(listOf(PhotoNote("p1", now + 10_000, null, null)), log.notesBetween(0, Long.MAX_VALUE))
        log.close()
    }

    @Test
    fun remembersHandledFilesAndQueuesEachDocumentOnce() {
        val log = PhotoLog(context, "outbox.db")
        assertFalse(log.isHandled(7))
        log.markHandled(7, now)
        assertTrue(log.isHandled(7))

        assertTrue(log.enqueueDocument("k1", "IMG-1.jpg", Screening.IMAGE, "Jadłospis", "/files/7.jpg", now))
        assertFalse(log.enqueueDocument("k1", "IMG-1.jpg", Screening.IMAGE, "Jadłospis", "/files/7.jpg", now))
        val doc = log.pendingDocuments().single()
        assertEquals(PendingDocument(doc.rowId, "k1", "IMG-1.jpg", Screening.IMAGE, "Jadłospis", "/files/7.jpg", 0, now), doc)
        log.markAttempt(doc.rowId)
        assertEquals(1, log.pendingDocuments().single().attempts)
        log.removeDocument(doc.rowId)
        assertTrue(log.pendingDocuments().isEmpty())
        log.close()
    }
}
