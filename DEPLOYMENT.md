GharSathi deployment and verification

The production backend is the existing Render service `srv-dbcbvv3ncjis73917ol0`
in the confirmed workspace. It must use `https://github.com/kishan-kumar3050/gharsathi`,
branch `main`, root directory `backend/`. Render currently stores the previous owner URL `jaikishan3050/gharsathi`, which
GitHub redirects to the same repository ID. The confirmed failure is a stale
live deployment, not a separate repository. Verify the deployed SHA explicitly.
Do not create replacement infrastructure or reset the existing database.

Firebase Hosting uses project/site `gharsathi-in`, with `bookgharsathi.in` as the
requested custom domain. Build and deploy from `GharSathi_React/`, where the
hosting public directory is `dist`.

Before publishing, review and merge the fix PR and run CI. On a clean checkout of
that exact main commit:

```powershell
cd GharSathi_React
npm ci
npm run test
npm run build
firebase deploy --only hosting --project gharsathi-in --non-interactive
cd ..
python smoke_test_live.py --expected-commit <full-main-sha>
```

The build emits `build-info.json` containing the commit and dirty flag. Hosting
must serve that file and the HTML entry without caching. Backend `/` runs a real
database probe and exposes the provider-supplied `RENDER_GIT_COMMIT`, never a
hardcoded deployment claim. Render's automatic deploy should be monitored after
a main push; do not trigger a second deployment while one is already running.
Container builds must pass the reviewed full revision as the `BUILD_COMMIT`
build argument. Compose forwards `GITHUB_SHA` in CI. A container built without a
revision is marked `unknown`/dirty and cannot pass deployment verification.

Configure existing server secrets in Render's Environment page; never put them
in code, PR descriptions, command arguments or chat:

- `SECRET_KEY`: retain the existing strong deployment key unless explicitly rotating it.
- `DATABASE_URL`: retain the existing production database connection.
- `SMS_PROVIDER`: `fast2sms` or `twilio`, with the matching provider credentials.
- `DEBUG=False`, `OTP_EXPOSE_DEBUG_CODE=False`.
- `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`: matching gateway credentials.
- `FRONTEND_BASE_URL=https://bookgharsathi.in` and the domain in allowed CORS origins.

OTP issuance fails with 503 if SMS delivery fails; production never returns the
code. Configure and verify the SMS provider before releasing the authentication
change. Technician sessions issued before the credential-version change require
a fresh login; password reset invalidates previous technician JWTs. The migration
removes the default technician password and does not rewrite existing passwords.
Rotate any real gateway credentials previously committed to repository history
through the provider's secure credential workflow.

The safe smoke script is read-only. Successful output verifies the tested
availability, revision, CORS and anonymous-access checks. It does not certify a
positive booking flow, SMS delivery, PostgreSQL concurrency or captured payments.
Run those flows in a dispatch-disabled staging environment, with Razorpay test
keys. Do not execute real payments as part of deployment verification.
