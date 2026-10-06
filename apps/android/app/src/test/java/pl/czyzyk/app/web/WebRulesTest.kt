package pl.czyzyk.app.web

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class WebRulesTest {
    private val app = "https://czyzyk.up.railway.app"

    @Test
    fun normalizesTypedAddressToHttpsOrigin() {
        assertEquals(app, WebRules.normalizeAppUrl(" czyzyk.up.railway.app/ "))
        assertEquals(app, WebRules.normalizeAppUrl("https://CZYZYK.up.railway.app/dzis?x=1"))
        assertEquals("http://10.0.2.2:5173", WebRules.normalizeAppUrl("http://10.0.2.2:5173"))
        assertNull(WebRules.normalizeAppUrl("http://czyzyk.example"))
        assertNull(WebRules.normalizeAppUrl("javascript:alert(1)"))
        assertNull(WebRules.normalizeAppUrl("   "))
        assertNull(WebRules.normalizeAppUrl(null))
    }

    @Test
    fun onlyPwaPagesStayInTheWebView() {
        assertTrue(WebRules.isInApp("$app/kalendarz?miesiac=2026-10", app))
        assertTrue(WebRules.isInApp("https://czyzyk.up.railway.app:443/", app))
        assertFalse(WebRules.isInApp("https://abc.supabase.co/auth/v1/authorize?provider=google", app))
        assertFalse(WebRules.isInApp("https://accounts.google.com/o/oauth2/v2/auth", app))
        assertFalse(WebRules.isInApp("http://czyzyk.up.railway.app/", app))
        assertFalse(WebRules.isInApp("https://czyzyk.up.railway.app.evil.example/", app))
    }

    @Test
    fun authCallbackLoadsTheCodeOnThePwaRoot() {
        val link = "czyzyk://auth/callback?code=abc-123&state=x&next=https%3A%2F%2Fevil.example"
        assertTrue(WebRules.isAuthCallback(link))
        assertEquals("$app/?code=abc-123", WebRules.authCallbackTarget(link, app))
        assertEquals(
            "$app/?error=access_denied&error_description=User+cancelled",
            WebRules.authCallbackTarget("czyzyk://auth/callback?error=access_denied&error_description=User+cancelled", app),
        )
        assertNull(WebRules.authCallbackTarget("czyzyk://auth/callback", app))
        assertNull(WebRules.authCallbackTarget("czyzyk://pair?server=x", app))
        assertFalse(WebRules.isAuthCallback("czyzyk://auth/other?code=1"))
    }
}
