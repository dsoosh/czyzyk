package pl.czyzyk.app

import org.junit.Assert.assertEquals
import org.junit.Test

class AppInfoTest {
    @Test
    fun appNameIsPolish() {
        assertEquals("Czyżyk", AppInfo.NAME)
    }
}
