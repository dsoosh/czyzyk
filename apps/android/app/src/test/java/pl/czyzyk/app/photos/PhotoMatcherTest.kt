package pl.czyzyk.app.photos

import org.junit.Assert.assertEquals
import org.junit.Test

class PhotoMatcherTest {
    private val t0 = 1_791_388_920_000L
    private fun image(addedAt: Long) = MediaImage(1, "IMG-20261007-WA0003.jpg", addedAt)
    private fun tracked(key: String, at: Long, group: String = "Motylki") = PhotoNote(key, at, key, group)
    private fun other(key: String, at: Long) = PhotoNote(key, at, null, null)

    @Test
    fun fileShortlyAfterATrackedPhotoBelongsToThatMessage() {
        assertEquals(PhotoMatch.Message("k1"), PhotoMatcher.match(image(t0 + 20_000), listOf(tracked("k1", t0))))
    }

    @Test
    fun aPhotoFromAnotherChatInTheWindowMakesItAmbiguous() {
        val notes = listOf(tracked("k1", t0), other("prywatny", t0 + 30_000))
        assertEquals(PhotoMatch.Ambiguous, PhotoMatcher.match(image(t0 + 40_000), notes))
    }

    @Test
    fun twoTrackedGroupsAtOnceAreAmbiguous() {
        val notes = listOf(tracked("k1", t0), tracked("k2", t0 + 5_000, group = "Sokoły"))
        assertEquals(PhotoMatch.Ambiguous, PhotoMatcher.match(image(t0 + 10_000), notes))
    }

    @Test
    fun anAlbumOfOneGroupGoesToTheClosestEarlierPhoto() {
        val notes = listOf(tracked("k1", t0), tracked("k2", t0 + 3_000), tracked("k3", t0 + 400_000))
        assertEquals(PhotoMatch.Message("k2"), PhotoMatcher.match(image(t0 + 10_000), notes))
    }

    @Test
    fun noNoticeAroundTheFile() {
        assertEquals(PhotoMatch.NoNotification, PhotoMatcher.match(image(t0), listOf(tracked("k1", t0 - PhotoMatcher.BEFORE_MILLIS - 1))))
        assertEquals(PhotoMatch.NoNotification, PhotoMatcher.match(image(t0), emptyList()))
    }

    @Test
    fun aFileIndexedJustBeforeTheNoticeStillMatches() {
        assertEquals(PhotoMatch.Message("k1"), PhotoMatcher.match(image(t0), listOf(tracked("k1", t0 + 60_000))))
    }
}
