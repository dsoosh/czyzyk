package pl.czyzyk.app.capture

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class CapturePolicyTest {
    private fun group(name: String) = ParseResult.Group(
        name,
        listOf(CapturedMessage("com.whatsapp", name, "Ktoś", "treść", 1000, false, "key-$name")),
    )

    @Test
    fun untrackedGroupIsNotQueuedButItsNameIsReported() {
        val decision = CapturePolicy.decide(group("Sąsiedzi"), tracked = setOf("Motylki"), alreadyReported = emptySet())
        assertTrue(decision.toQueue.isEmpty())
        assertEquals("Sąsiedzi", decision.groupToReport)
    }

    @Test
    fun trackedGroupIsQueued() {
        val decision = CapturePolicy.decide(group("Motylki"), tracked = setOf("Motylki"), alreadyReported = setOf("Motylki"))
        assertEquals(1, decision.toQueue.size)
        assertNull(decision.groupToReport)
    }
}
