package pl.czyzyk.app.pairing

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class PairingLinkTest {
    private val token = "ab".repeat(32)

    @Test
    fun parsesLinkFromAdminPanel() {
        val pairing = PairingLink.parse("czyzyk://pair?server=https%3A%2F%2Fapi.czyzyk.example%2F&token=$token")
        assertEquals(Pairing("https://api.czyzyk.example", token), pairing)
    }

    @Test
    fun acceptsSurroundingWhitespaceAndUppercaseToken() {
        val pairing = PairingLink.parse("  czyzyk://pair?server=https%3A%2F%2Fa.b&token=${token.uppercase()}\n")
        assertEquals(token, pairing?.token)
    }

    @Test
    fun rejectsInvalidLinks() {
        assertNull(PairingLink.parse("https://api.czyzyk.example?token=$token"))
        assertNull(PairingLink.parse("czyzyk://other?server=https%3A%2F%2Fa.b&token=$token"))
        assertNull(PairingLink.parse("czyzyk://pair?server=https%3A%2F%2Fa.b&token=short"))
        assertNull(PairingLink.parse("czyzyk://pair?token=$token"))
        assertNull(PairingLink.parse("czyzyk://pair?server=http%3A%2F%2Fa.b&token=$token"))
        assertNull(PairingLink.parse("nonsense"))
    }

    @Test
    fun allowsPlainHttpOnlyForLocalDevelopment() {
        assertEquals("http://10.0.2.2:3000", PairingLink.parse("czyzyk://pair?server=http%3A%2F%2F10.0.2.2%3A3000&token=$token")?.serverUrl)
    }

    @Test
    fun neverPrintsTheToken() {
        assert(!Pairing("https://a.b", token).toString().contains(token))
    }
}
