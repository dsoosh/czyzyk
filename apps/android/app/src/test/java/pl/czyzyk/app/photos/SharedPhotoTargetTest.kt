package pl.czyzyk.app.photos

import org.junit.Assert.assertEquals
import org.junit.Test

class SharedPhotoTargetTest {
    private val now = 1_791_388_920_000L
    private fun tracked(key: String, ago: Long, group: String) = PhotoNote(key, now - ago, key, group)

    @Test
    fun oneGroupGetsItsNewestPhoto() {
        val notes = listOf(tracked("k1", 600_000, "Motylki"), tracked("k2", 60_000, "Motylki"), PhotoNote("p", now, null, null))
        assertEquals(SharedPhotoTarget.Single(notes[1]), SharedPhotoTarget.choose(notes, now))
    }

    @Test
    fun severalGroupsAreOfferedNewestFirst() {
        val motylki = tracked("k1", 60_000, "Motylki")
        val sokoly = tracked("k2", 30_000, "Sokoły")
        val older = tracked("k0", 90_000, "Sokoły")
        assertEquals(SharedPhotoTarget.Choose(listOf(sokoly, motylki)), SharedPhotoTarget.choose(listOf(motylki, older, sokoly), now))
    }

    @Test
    fun nothingRecentFromTrackedGroups() {
        val old = tracked("k1", SharedPhotoTarget.WINDOW_MILLIS + 1, "Motylki")
        assertEquals(SharedPhotoTarget.None, SharedPhotoTarget.choose(listOf(old, PhotoNote("p", now, null, null)), now))
    }
}
