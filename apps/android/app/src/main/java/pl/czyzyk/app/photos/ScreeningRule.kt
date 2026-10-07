package pl.czyzyk.app.photos

/** What may leave the phone for one photo (document-import). */
enum class Screening(val wire: String?) {
    /** A document without people: the image (re-encoded, no EXIF) and its text. */
    IMAGE("image"),
    /** A document with people on it: only the text read on the phone. */
    TEXT_ONLY("text_only"),
    /** Anything else: nothing is sent. */
    WITHHELD(null),
}

/** What the on-device detectors found on a photo. */
data class ScreeningFacts(
    val width: Int,
    val height: Int,
    val words: Int,
    /** Share of the image area covered by recognised text, 0..1. */
    val textCoverage: Float,
    val faces: Int,
    /** Highest confidence of a person-related image label, 0..1. */
    val personLabel: Float,
)

/**
 * The on-device decision (design D1). Unknown or failed analysis is never sent; a face or a
 * person anywhere rules out sending the image.
 */
object ScreeningRule {
    const val MIN_SIDE = 400
    const val MIN_WORDS = 15
    const val MIN_TEXT_COVERAGE = 0.05f
    const val PERSON_LABEL_THRESHOLD = 0.3f

    /** ML Kit base image labels that mean a person (or part of one) is on the photo. */
    val PERSON_LABELS = setOf(
        "Person", "Baby", "Child", "Kid", "Toddler", "Selfie", "Smile", "Face", "Hand", "Skin", "Hair", "Beard",
        "Eyelash", "Ear", "Nail", "Muscle", "Crowd", "Team", "Dance", "Gymnastics", "Swimming", "Bride", "Groom",
        "Student", "Sitting", "Standing", "Fun", "Event", "Party",
    )

    fun decide(facts: ScreeningFacts?): Screening {
        if (facts == null) return Screening.WITHHELD
        if (minOf(facts.width, facts.height) < MIN_SIDE) return Screening.WITHHELD
        if (facts.words < MIN_WORDS && facts.textCoverage < MIN_TEXT_COVERAGE) return Screening.WITHHELD
        if (facts.faces > 0 || facts.personLabel >= PERSON_LABEL_THRESHOLD) return Screening.TEXT_ONLY
        return Screening.IMAGE
    }
}
