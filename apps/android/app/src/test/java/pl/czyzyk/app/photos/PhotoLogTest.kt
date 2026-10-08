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

    @Test
    fun ownPhotoRemembersItsGroup() {
        val log = PhotoLog(context, "own.db")
        assertTrue(log.enqueueDocument("u1", "plakat.jpg", Screening.IMAGE, "Bal", "/files/p.jpg", now, groupName = "Motylki"))
        assertEquals("Motylki", log.pendingDocuments().single().groupName)
        log.close()
    }

    @Test
    fun previewsWaitAndMatchedMessagesAreRemembered() {
        val log = PhotoLog(context, "previews.db")
        assertTrue(log.addNote(PhotoNote("k1", now, "k1", "Motylki")))
        assertFalse(log.addNote(PhotoNote("k1", now, "k1", "Motylki")))
        assertTrue(log.addPreview("k1", "/files/previews/k1.img", now))
        assertFalse(log.addPreview("k1", "/files/previews/k1.img", now))
        assertTrue(log.hasPreview("k1"))
        assertTrue(log.previewsBefore(now - 1).isEmpty())
        assertEquals(listOf("k1" to "/files/previews/k1.img"), log.previewsBefore(now))
        log.removePreview("k1")
        assertFalse(log.hasPreview("k1"))

        assertFalse(log.isMatched("k1"))
        log.markMatched("k1", now)
        assertTrue(log.isMatched("k1"))
        assertEquals(listOf(PhotoNote("k1", now, "k1", "Motylki")), log.trackedNotesSince(now - 1))
        log.close()
    }
}
