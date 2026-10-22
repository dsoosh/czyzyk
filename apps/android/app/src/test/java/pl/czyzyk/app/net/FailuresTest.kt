package pl.czyzyk.app.net

import org.junit.Assert.assertEquals
import org.junit.Test

class FailuresTest {
    @Test
    fun describesHttpStatusesAndNetworkErrors() {
        assertEquals("błąd serwera (HTTP 500)", failureLabel("http 500"))
        assertEquals("serwer ogranicza liczbę zapytań (HTTP 429)", failureLabel("http 429"))
        assertEquals("serwer odrzucił zapytanie (HTTP 404)", failureLabel("http 404"))
        assertEquals("nie znaleziono serwera – sprawdź internet i adres serwera", failureLabel("UnknownHostException"))
        assertEquals("serwer nie odpowiada (przekroczony czas)", failureLabel("SocketTimeoutException"))
        assertEquals("błąd połączenia (SSLHandshakeException)", failureLabel("SSLHandshakeException"))
        assertEquals("coś innego", failureLabel("coś innego"))
    }
}
