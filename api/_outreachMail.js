// The outreach mailbox: sending (SMTP) and reading replies (IMAP), for midhat@certify.wiki on the Namecheap
// cPanel hosting. Kept apart from the Resend sender on purpose: cold outreach must not run through the
// transactional service (its policy forbids unsolicited mail) and must not touch certify.cx's reputation.
//
// Settings come from environment variables; the password is never in the repository or in chat:
//   OUTREACH_SMTP_HOST   e.g. business117.web-hosting.com
//   OUTREACH_SMTP_PORT   465 (SSL), the default
//   OUTREACH_SMTP_USER   midhat@certify.wiki
//   OUTREACH_SMTP_PASS   the mailbox password (Vercel environment variable only)
//   OUTREACH_FROM_NAME   "Midhat Abu-Ghazaleh" (default)
//   OUTREACH_IMAP_HOST   defaults to the SMTP host; OUTREACH_IMAP_PORT defaults to 993
//
// The two libraries are loaded when first used, so the unit tests and every other route stay light.

import crypto from 'node:crypto';

export function outreachMailConfig(env = process.env) {
  const host = env.OUTREACH_SMTP_HOST || '';
  const user = env.OUTREACH_SMTP_USER || '';
  const pass = env.OUTREACH_SMTP_PASS || '';
  return {
    host,
    port: Number(env.OUTREACH_SMTP_PORT) || 465,
    user,
    pass,
    fromName: env.OUTREACH_FROM_NAME || 'Midhat Abu-Ghazaleh',
    imapHost: env.OUTREACH_IMAP_HOST || host,
    imapPort: Number(env.OUTREACH_IMAP_PORT) || 993,
    configured: Boolean(host && user && pass),
  };
}

/** A Message-ID on the sending domain, so a reply can be matched back to the email it answers. */
export function newMessageId(user) {
  const domain = String(user || '').split('@')[1] || 'certify.wiki';
  return `<${crypto.randomUUID()}@${domain}>`;
}

export function createMailer(cfg = outreachMailConfig()) {
  let transporter = null;

  return {
    configured: cfg.configured,
    from: `"${cfg.fromName}" <${cfg.user}>`,
    user: cfg.user,

    async send({ to, subject, html, text, messageId, inReplyTo, references, headers }) {
      if (!cfg.configured) throw Object.assign(new Error('The outreach mailbox is not configured'), { code: 'ENOCONFIG' });
      if (!transporter) {
        const nodemailer = (await import('nodemailer')).default;
        transporter = nodemailer.createTransport({
          host: cfg.host, port: cfg.port, secure: cfg.port === 465,
          auth: { user: cfg.user, pass: cfg.pass },
          tls: { minVersion: 'TLSv1.2' },
          connectionTimeout: 8000, greetingTimeout: 8000, socketTimeout: 12000,
        });
      }
      const info = await transporter.sendMail({
        from: `"${cfg.fromName}" <${cfg.user}>`, to, subject, html, text,
        messageId, inReplyTo, references, headers,
      });
      return { messageId: info.messageId || messageId, accepted: info.accepted || [] };
    },

    /** Messages that reached the inbox since a date, with what is needed to match them to a lead. */
    async fetchSince(since) {
      if (!cfg.configured) return [];
      const { ImapFlow } = await import('imapflow');
      const client = new ImapFlow({
        host: cfg.imapHost, port: cfg.imapPort, secure: true,
        auth: { user: cfg.user, pass: cfg.pass }, logger: false,
        socketTimeout: 15000,
      });
      const found = [];
      await client.connect();
      const lock = await client.getMailboxLock('INBOX');
      try {
        const uids = (await client.search({ since })) || [];
        for (const uid of uids.slice(-200)) {
          const msg = await client.fetchOne(uid, { envelope: true, headers: ['in-reply-to', 'references', 'auto-submitted', 'x-autoreply', 'precedence'], source: { start: 0, maxLength: 24000 } }, { uid: true });
          if (!msg) continue;
          const headerText = msg.headers ? msg.headers.toString('utf8') : '';
          const header = (name) => (headerText.match(new RegExp(`^${name}:\\s*(.+)$`, 'im')) || [])[1]?.trim() || '';
          found.push({
            from: msg.envelope?.from?.[0]?.address || '',
            subject: msg.envelope?.subject || '',
            date: msg.envelope?.date || null,
            inReplyTo: header('in-reply-to'),
            references: header('references'),
            autoSubmitted: header('auto-submitted') || header('x-autoreply') || (/bulk|auto_reply/i.test(header('precedence')) ? 'yes' : ''),
            body: msg.source ? msg.source.toString('utf8') : '',
          });
        }
      } finally {
        lock.release();
        await client.logout().catch(() => {});
      }
      return found;
    },
  };
}
