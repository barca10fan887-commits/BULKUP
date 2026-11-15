# Putting BULKUP on the App Store

BULKUP's native iPhone app lives in `ios/` (built with Capacitor). A GitHub Actions workflow builds it on Apple hardware in the cloud and uploads it to App Store Connect, so **you don't need a Mac**.

The path is: **Apple Developer account → app record → API key → GitHub secrets → run the workflow → TestFlight link → submit for review.**

## 1. Join the Apple Developer Program

Enrol at developer.apple.com/programs. It costs US$99 (A$149) a year. Approval as an individual usually takes a day or two. To publish under a business name you need a D-U-N-S number.

## 2. Register the app

1. In developer.apple.com > **Certificates, IDs & Profiles > Identifiers**, add an **App ID** with a Bundle ID such as `com.yourname.bulkup`. Tick **Push Notifications** if you plan to add push later (reminders don't need it).
2. In appstoreconnect.apple.com > **Apps > +**, choose **New App**: platform iOS, name **BULKUP** (or the closest available name), select the Bundle ID from step 1, and use any SKU you like (e.g. `bulkup-001`).

## 3. Create an App Store Connect API key

App Store Connect > **Users and Access > Integrations > App Store Connect API > Team Keys > +**

- Name: `GitHub Actions`
- Access: **Admin**. This lets the cloud build create signing certificates automatically.
- Download the `.p8` file. You can only download it once, so keep it somewhere safe.
- Note the **Key ID** and the **Issuer ID** shown on that page.

Your **Team ID** is under developer.apple.com > **Membership details**.

## 4. Add the values to GitHub

In the GitHub repository: **Settings > Secrets and variables > Actions**

| Type | Name | Value |
| --- | --- | --- |
| Secret | `APPLE_TEAM_ID` | Your 10-character Team ID |
| Secret | `APP_STORE_CONNECT_KEY_ID` | Key ID |
| Secret | `APP_STORE_CONNECT_ISSUER_ID` | Issuer ID |
| Secret | `APP_STORE_CONNECT_KEY_P8` | Open the `.p8` file in a text editor and paste everything, including the BEGIN and END lines |
| Variable | `APP_BUNDLE_ID` | The Bundle ID from step 2 |
| Variable (optional) | `VITE_API_BASE_URL` | Your server address (e.g. `https://bulkup.onrender.com`) to enable the AI coach and photo scanner in the app |

## 5. Build and upload

GitHub > **Actions > iOS build to TestFlight > Run workflow** and enter a version (e.g. `1.0.0`). The run takes about 10-20 minutes. Apple then processes the build for another 10-30 minutes.

## 6. Install on your iPhone with TestFlight

1. App Store Connect > your app > **TestFlight**. If asked about encryption, the app already declares that it doesn't use non-exempt encryption.
2. Add yourself under **Internal Testing**.
3. Install the **TestFlight** app from the App Store and accept the invite. BULKUP installs like any other app.
4. For friends, create an **External Testing** group and share the **public TestFlight link**. External groups need a quick Apple beta review the first time.

## 7. Submit to the App Store

In App Store Connect > your app > the **App Store** tab:

- **Screenshots:** 6.9" iPhone screenshots are required (1320 × 2868). Take them in the TestFlight build.
- **Description, keywords, support URL.**
- **Privacy Policy URL:** `https://<your-github-username>.github.io/<repo>/privacy.html`. First edit `public/privacy.html` to add your support email.
- **App Privacy questionnaire:** declare health & fitness data, photos, name and email (if accounts are on), and "data used for app functionality, not tracking".
- **Age rating:** answer the questionnaire. Expect around 4+ or 12+.
- **Review notes:** if accounts are enabled, give the reviewer a demo login. Mention that AI estimates are labelled as estimates.

Choose the uploaded build, then **Submit for Review**. Reviews typically take 1-3 days.

### Review tips for this app

- **Guideline 4.2 (minimum functionality):** Apple rejects apps that are only a website in a wrapper. BULKUP uses native reminders scheduled by iOS, the camera for barcodes and photos, and works fully offline, which helps. Mention these features in the review notes.
- **Guideline 5.1.1(v):** if users can create accounts, they must be able to delete them in the app. This is already built into Settings > Your data.
- **Health claims:** keep the store description to "tracking" and "estimates". Don't promise medical outcomes.

## Updating the app

Push your changes, then run the workflow again with a higher version (e.g. `1.0.1`). The build number increases automatically.

## Working on a Mac (optional)

```bash
npm run build:native
```

```bash
npm run ios:open
```

The second command opens Xcode, where you can run the app on a simulator or a connected iPhone.
