package pl.czyzyk.app.capture

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Test
import java.util.UUID

class Uuid5Test {
    @Test
    fun matchesRfc4122Example() {
        val dns = UUID.fromString("6ba7b810-9dad-11d1-80b4-00c04fd430c8")
        assertEquals("2ed6657d-e927-568b-95e1-2665a8aea6a2", Uuid5.of(dns, "www.example.com").toString())
    }

    @Test
    fun isStableAndDistinct() {
        assertEquals(Uuid5.of(Uuid5.MESSAGES, "a"), Uuid5.of(Uuid5.MESSAGES, "a"))
        assertNotEquals(Uuid5.of(Uuid5.MESSAGES, "a"), Uuid5.of(Uuid5.MESSAGES, "b"))
    }
}
