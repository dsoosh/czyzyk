package pl.czyzyk.app.photos

import org.junit.Assert.assertEquals
import org.junit.Test

class ScreeningRuleTest {
    private val document = ScreeningFacts(width = 1500, height = 2000, words = 80, textCoverage = 0.3f, faces = 0, personLabel = 0f)

    @Test
    fun documentWithoutPeopleIsSentAsImage() {
        assertEquals(Screening.IMAGE, ScreeningRule.decide(document))
    }

    @Test
    fun aFaceOrAPersonLabelLeavesOnlyTheText() {
        assertEquals(Screening.TEXT_ONLY, ScreeningRule.decide(document.copy(faces = 2)))
        assertEquals(Screening.TEXT_ONLY, ScreeningRule.decide(document.copy(personLabel = 0.31f)))
    }

    @Test
    fun photoWithoutReadableTextStaysOnThePhone() {
        assertEquals(Screening.WITHHELD, ScreeningRule.decide(document.copy(words = 3, textCoverage = 0.01f, faces = 3)))
        assertEquals(Screening.WITHHELD, ScreeningRule.decide(document.copy(words = 3, textCoverage = 0.01f)))
    }

    @Test
    fun aShortButLargeTextStillCounts() {
        assertEquals(Screening.IMAGE, ScreeningRule.decide(document.copy(words = 6, textCoverage = 0.2f)))
    }

    @Test
    fun smallImagesAndFailedAnalysisAreWithheld() {
        assertEquals(Screening.WITHHELD, ScreeningRule.decide(document.copy(width = 300)))
        assertEquals(Screening.WITHHELD, ScreeningRule.decide(null))
    }

    @Test
    fun wireNamesMatchTheServer() {
        assertEquals("image", Screening.IMAGE.wire)
        assertEquals("text_only", Screening.TEXT_ONLY.wire)
        assertEquals(null, Screening.WITHHELD.wire)
    }
}
