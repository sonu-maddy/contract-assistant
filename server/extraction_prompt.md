# Contract Extraction Instructions

Extract all important contract facts that can be represented as structured items.

## Required extraction behavior

Extract separate items whenever the contract contains them:

- party
- effective_date
- expiry_date
- renewal
- notice
- termination
- obligation
- ambiguity

## Dates and contract terms

Extract the effective date when explicitly stated.

Extract an explicit expiry date when the contract states one.

If the contract states an initial term but does not state an explicit expiry date, extract the initial term as a `renewal` item or another available duration-bearing item.

Examples:

"Effective Date: October 1, 2026."
→ type: effective_date
→ value: "October 1, 2026"

"The initial term is twelve (12) months."
→ type: renewal
→ value: "12 months"

"Either party may terminate by providing thirty (30) days written notice."
→ type: notice
→ value: "30 days"

"Automatically renews for successive periods of twelve (12) months."
→ type: renewal
→ value: "12 months"

## Important

Do not invent dates.

Do not calculate dates in the LLM.

Extract the source facts only.

The application will perform deterministic date calculations after extraction.

Every extracted item should include an exact sourceQuote whenever possible.

If information is ambiguous, mark confidence as "uncertain" and preserve the ambiguity rather than guessing.