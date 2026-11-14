# Product review interactions

Implemented November 11, 2026. Migration `022_review_interactions.sql` was applied to the existing project after local tests.

The owner approved allowing any signed-in customer to submit a review. Submissions remain unpublished until approved by the existing MFA-protected moderation flow. The existing user/product uniqueness constraint prevents repeat submissions. Only a matched paid, delivered purchase sets the existing purchase-verification field; imported feedback remains unchanged.

The Add a Review action retains the product and variant through email/password sign-in, registration confirmation and OAuth redirects. Redirect destinations are restricted to product routes. An authenticated return opens and scrolls to the form. Half-star ratings remain supported.

Likes use the new `review_likes` relation with RLS and no direct client table privileges. The two narrowly scoped RPCs expose counts and the requesting browser's liked state for approved reviews on published products. The unique review/visitor pair makes retries idempotent. Identifiers are hashed at rest; the existing request limiter bounds requests per visitor identifier. Guest likes identify a browser, not a unique person; clearing browser storage can produce another identifier. No claims of purchaser identity are inferred from likes.

Reporting controls and their frontend handlers were removed. Existing report records were retained. Product external manufacturer links and displayed stock counts were removed; inventory quantities and purchase enforcement were preserved.

Validation: 55 automated tests passed, the frontend build passed, and all four Edge Functions passed the existing TypeScript parse check. All 13 connected product pages were inspected at 1280px and 390px. A separate local fixture tested guest likes, reload persistence, sign-in/signup gating, product-specific return, 4.5-star submission and duplicate state. Fixture authentication is not a live Google or email signup test.

Hosted SQL tests submitted a pending review and repeated anonymous likes inside a rolled-back transaction. Guest submission was denied. Review and inventory digests matched the preflight, with 150 original reviews and zero test likes retained. Public API checks covered review-like aggregates for all 13 products, anonymous review denial, Email/Google provider enablement and the store-api authentication boundary.

Checkout was already disabled and remains disabled. No orders, payment/refund operations, emails, customer credentials or stock changes were made during testing. A full production payment test was not performed. The frontend build has not been published to public hosting.

Private preflight function definitions, API verification and browser evidence are in `.private/review-interactions/`. Recovery SQL in `supabase/setup/rollback-review-interactions.sql` restores prior review eligibility/submission and removes public execution of like RPCs, retaining all records. It has not been executed.

With the owner's explicit approval, the Auth Site URL was changed to `http://localhost:4173/`, with `http://localhost:4173/**` and `https://coastlinedevice.com/**` allowed redirects. The saved configuration was verified after reloading the dashboard. A fresh live OAuth/email-confirmation callback still requires an end-user test. Before public launch, the default Site URL should be switched to the production domain.

The final admin Reviews view retained 20 approval and rejection controls on its first page and contained no reporting text. Existing report records remain untouched.
