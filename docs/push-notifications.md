# PWA push notifications

The theme shows a publication subscription card after every article and note.
The browser permission prompt is only opened after a click.

The backend lives in the sibling `idel-blog-push-service` project. Its container
joins `dokploy-network` with the `idel-blog-push-service` alias used by nginx.

## Configure VAPID

Generate one VAPID key pair and keep it stable. Changing the keys invalidates
existing browser subscriptions.

```sh
cd ../idel-blog-push-service
npx web-push generate-vapid-keys
```

Set these deployment environment variables:

```dotenv
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:push@idel.blog
GHOST_WEBHOOK_SECRET=...
```

`GHOST_WEBHOOK_SECRET` should be a long random value and must match the webhook
secret configured in Ghost Admin.

## Configure Ghost

In Ghost Admin, open **Settings > Advanced > Integrations**, create a custom
integration, and add a webhook:

- Event: `Post published`
- Target URL: `https://idel.blog/webhooks/ghost/post-published`
- Secret: the value of `GHOST_WEBHOOK_SECRET`

The push service accepts only current, signed webhooks. It skips email-only and
members-only posts. Posts tagged with the internal `#note` tag use the same
subscription and are delivered as notes. Notification bodies preserve paragraph
breaks and list markers while remaining plain text for cross-platform support.

## Deploy

Deploy `docker-compose.pwa.yml` after setting the environment variables. Verify
the service through the public proxy:

```sh
curl https://idel.blog/api/push/config
```

A configured service returns `enabled: true` and the public VAPID key. Never
publish the private VAPID key or the Ghost webhook secret.
