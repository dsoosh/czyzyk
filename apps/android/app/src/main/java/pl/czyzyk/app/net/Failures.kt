package pl.czyzyk.app.net

/**
 * Polish description of why contacting the server failed, for the status screen: the reason of
 * [SendResult.Retry] or [ConfigResult.Retry] ("http 500", "UnknownHostException", …).
 */
fun failureLabel(reason: String): String {
    val code = reason.removePrefix("http ").toIntOrNull()?.takeIf { reason.startsWith("http ") }
    return when {
        code == 429 -> "serwer ogranicza liczbę zapytań (HTTP 429)"
        code != null && code >= 500 -> "błąd serwera (HTTP $code)"
        code != null -> "serwer odrzucił zapytanie (HTTP $code)"
        reason == "UnknownHostException" -> "nie znaleziono serwera – sprawdź internet i adres serwera"
        reason == "SocketTimeoutException" -> "serwer nie odpowiada (przekroczony czas)"
        reason == "ConnectException" -> "brak połączenia z serwerem"
        reason == "invalid response" -> "niezrozumiała odpowiedź serwera"
        reason.endsWith("Exception") -> "błąd połączenia ($reason)"
        else -> reason
    }
}
