# Set Up Your Own Scheduling With GitHub

> **Who this is for:** the administrator of a Twiligent instance. Step 2 needs the secret key of the instance's Supabase project. If you only sign in to someone else's Twiligent, you need none of this: the server already publishes your scheduled posts. This backup is optional even for administrators; the Worker cron publishes on its own once the backend is deployed. The public docs cover the same steps at `https://twiligent.ujjwal.fyi/docs/self-host/github`.

GitHub can check your scheduled Instagram posts and publish the ones that are due, for free. It runs alongside the server's own scheduler as a backup, so posts still go out if the server is paused, though later: GitHub often starts these runs hours after their time. You set it up once. It takes about 5 minutes.

The same steps are in the app under **Settings, Scheduled publishing**, where typing your GitHub username turns every step into a direct link.

**You need:** a free GitHub account, and access to the Supabase project this Twiligent uses.

---

## Step 1. Make your own copy of Twiligent

1. Open https://github.com/spacesdrive/twiligent/fork
2. Choose **Create fork**. Keep it public, because GitHub runs public repositories for free.

**It worked if** you see `twiligent` under your own GitHub username.

## Step 2. Copy two values from Supabase

1. **Project URL.** In Supabase, open your project, then **Integrations, Data API**. It looks like `https://abcdefgh.supabase.co`.
2. **Secret key.** Open **Settings, API Keys** and copy a secret key. It starts with `sb_secret_`. If your project only shows legacy keys, copy **service_role** instead.

The secret key can read and change all your data. Paste it only into GitHub secrets in the next step, never into code, chat or email.

**It worked if** you have both values ready to paste.

## Step 3. Save the two values as secrets in your copy

1. In your copy on GitHub, open **Settings, Secrets and variables, Actions** (`https://github.com/YOUR-USERNAME/twiligent/settings/secrets/actions`).
2. Choose **New repository secret**, type the name exactly, paste the value, and choose **Add secret**. Do it twice:

| Name | Value |
|---|---|
| `SUPABASE_URL` | The project URL from step 2 |
| `SUPABASE_SERVICE_KEY` | The secret key from step 2 |

**It worked if** both names appear in the Repository secrets list.

## Step 4. Switch on the publisher

GitHub switches workflows off in new copies.

1. Open the **Actions** tab of your copy.
2. Choose **I understand my workflows, go ahead and enable them**.
3. Choose **Instagram Scheduled Publisher** in the list on the left. If a yellow banner says it is disabled, choose **Enable workflow**.

**It worked if** Instagram Scheduled Publisher is listed with no disabled warning.

## Step 5. Run it once to test

1. On the Instagram Scheduled Publisher page, choose **Run workflow**, then the green **Run workflow** button.
2. Refresh after a few seconds and open the new run.

**It worked if** the run shows a green tick after about a minute. A log line saying "No posts due for publishing" is fine.

| What you see | What it means | Fix |
|---|---|---|
| Red cross, "Error: missing SUPABASE_URL or SUPABASE_SERVICE_KEY" | A secret name is misspelled | Check the names in step 3 |
| Red cross, "Supabase GET ... 401" | The secret key is wrong or cut short | Copy the key again in step 2 and replace the secret |
| No Run workflow button | The workflow is still switched off | Repeat step 4 |

---

## After setup

- The workflow asks GitHub for a run every 15 minutes, at minutes 7, 22, 37 and 52 of each hour. You do not need to keep anything open.
- GitHub starts scheduled runs when it has capacity. Its own documentation says they can be delayed, most of all at the start of every hour, and that some are dropped. Over two days this project's own runs came every 3 to 5 hours. The server's scheduler is the one that publishes within 15 minutes; this backup catches what it missed, when GitHub gets to it.
- Only one run works at a time, and each run stops after 14 minutes. A run that starts while another is busy waits for it.
- The workflow runs `node scripts/publish-scheduled.ts` on Node 24, which runs the TypeScript file directly. It installs nothing, so there is no build step to maintain in your copy.
- The server scheduler and this workflow can run at the same time. Each post is claimed by whichever runs first, so it is published once. If a run stops halfway, the next run after 20 minutes takes the post over and checks Instagram before publishing, so the post is not published twice.
- If nothing changes in your copy for 60 days, GitHub pauses the schedule and emails you. Repeat step 4.
- A private copy uses GitHub's free minutes (2,000 a month), and a run every 15 minutes uses more than that. Keep your copy public, or change `'7,22,37,52 * * * *'` to `'7,37 * * * *'` (every 30 minutes) in `.github/workflows/publish-scheduled.yml`.
