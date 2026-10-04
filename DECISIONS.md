## 1. Missing severity

Before deciding how to handle severity, I read at least 20 tickets from the dataset and also checked some other tickets randomly, including tickets like `tkt_0089` and `tkt_0058`.

I noticed that the tickets usually don't directly say something like `severity: high`. Instead, they use words or situations that give an idea about the severity.

Based on the tickets I checked, I used some simple rules:

- `critical` if the ticket says things like `critical`, `production is down`, `entire service is down`, or `completely down`.
- `high` if it contains things like `urgent`, `escalated`, `escalation`, `business impact`, or `cannot access`.
- `low` if it contains things like `minor`, `low priority`, or `when convenient`.
- If none of these are found, I don't have enough evidence to decide the severity.

For the last case, the provider uses `medium` as the schema-safe fallback, but also adds `severity` to `uncertain_fields`.

This way, I am not treating the guessed `medium` value as a confirmed value. The UI shows `Needs review` so the human reviewer can check and change it.

## 2. tkt_0058: French + EUR refund

For this case, I noticed that the schema expects `refund_amount` in USD, but the ticket contains the amount in EUR.

I decided not to convert EUR to USD automatically because the ticket does not provide an exchange rate. Converting it automatically could give the reviewer a wrong amount.

My approach is:

- First, check for a normal USD amount such as `$18,400`.
- If there is no USD amount, check for an amount followed by `EUR`, such as `4 820 EUR`.
- Extract the EUR amount, but keep it unconverted.
- Give it lower confidence (`0.4`) because it does not match the expected USD format.
- Add `refund_amount` to `uncertain_fields`.
- Add a warning telling the reviewer that the amount is in EUR and needs to be verified before export.

So the system does not silently treat a EUR amount as USD. It keeps the extracted value available, but clearly tells the reviewer that the currency needs to be checked and corrected.



## 3. tkt_0089: Multiple issues and renewal threat

`tkt_0089` contains three separate problems, but the schema only allows one category.

I decided not to try to force all three problems into one category. Instead, I let the provider extract one category and then check the original ticket for signs that it contains multiple issues.

For this ticket, the extraction service looks for phrases such as `three separate problems` or `three separate issues`. When it finds them, it adds this review reason:

> Ticket contains multiple issues but the schema allows one category.

This is a blocking review reason, so the ticket is marked as `needs_review` even if the extracted record passes Pydantic validation. I still keep the extracted record so the reviewer can edit it instead of starting from an empty record.

The ticket also contains a renewal threat. I check for phrases such as `do not renew`, `not renew`, and `non-renew`. When found, I add:

> Ticket contains a renewal/churn threat.

This is shown to the reviewer as an additional reason. I don't try to automatically make a separate category for it because the schema only supports one category.

## 4. tkt_0004 and tkt_0020: Insufficient ticket content

I decided that tickets containing only `please advise` or `?` are not useful enough to send through the extraction process.

The extraction service checks the combined subject and body before calling the provider. If the content is exactly `please advise` or `?`, it immediately returns:

- `status: needs_review`
- `reason: Insufficient ticket content`
- `record: None`

This avoids making the model guess values when there is not enough information in the ticket.

I also show `Insufficient ticket content` to the reviewer so it is clear why no extraction was created.

## 5. Progress reporting: Polling instead of streaming

I chose polling for progress reporting.

While the job is running, the frontend periodically asks the backend for the current job status and results. This lets the UI update the progress and show completed results while the rest of the tickets are still being processed.

I chose polling because it was simpler to implement with the HTTP endpoints I already had. I did not need to add a separate streaming connection such as SSE.

The main cost of polling is that the frontend makes repeated requests while the job is running. Updates can also be slightly delayed depending on the polling interval.

For this assignment, I felt that trade-off was reasonable because the implementation stays simple while still giving the reviewer automatic progress updates and partial results.

**## 6. Frontend testing**

If I added a frontend test, I would test the main review workflow rather than testing every visual detail.

The main test I would add is for the results page. It would render a result containing a `needs_review` record and verify that the review information is shown to the user. I would also test the result filter so that selecting `Needs review` only shows records that need review, while selecting `Human edited` only shows records where a human has changed at least one field.

I would also test that editing a field and saving it calls the update API and that the edited field is shown as human-edited afterward. This would cover the most important user interaction in the review workflow.