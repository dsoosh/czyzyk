package pl.czyzyk.app.capture

import org.junit.Assert.assertEquals
import org.junit.Test
import java.text.Normalizer

class GroupNamesTest {
    @Test
    fun stripsBidiIsolatesAndCollapsesSpaces() {
        assertEquals("SOKOŁY - Cztery Żywioły", GroupNames.normalize("⁨SOKOŁY - Cztery Żywioły⁩"))
        assertEquals("SOKOŁY - Cztery Żywioły", GroupNames.normalize("  SOKOŁY  -​  Cztery Żywioły "))
        assertEquals("Kotki", GroupNames.normalize("‎Kotki﻿"))
    }

    @Test
    fun composesPolishLettersAndKeepsCaseAndEmoji() {
        assertEquals("Żywioły", GroupNames.normalize(Normalizer.normalize("Żywioły", Normalizer.Form.NFD)))
        assertEquals("Sowy 🦉", GroupNames.normalize("Sowy 🦉"))
    }
}
