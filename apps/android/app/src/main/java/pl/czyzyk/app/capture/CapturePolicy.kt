package pl.czyzyk.app.capture

/** What to do with a parsed group notification (group-tracking). */
data class CaptureDecision(
    /** Messages to queue for upload – only from tracked groups. */
    val toQueue: List<CapturedMessage>,
    /** Group name to report to the server (names only, never content), or null if already reported. */
    val groupToReport: String?,
)

object CapturePolicy {
    fun decide(group: ParseResult.Group, tracked: Set<String>, alreadyReported: Set<String>): CaptureDecision =
        CaptureDecision(
            toQueue = if (group.groupName in tracked) group.messages else emptyList(),
            groupToReport = group.groupName.takeUnless { it in alreadyReported },
        )
}
