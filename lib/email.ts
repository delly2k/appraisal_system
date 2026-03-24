/**
 * Outbound email via Microsoft Graph (application permissions).
 * POST /v1.0/users/{fromEmail}/sendMail with OAuth2 client credentials.
 *
 * Azure app registration: Microsoft Graph application permission Mail.Send (admin consent).
 * Env: AZURE_AD_TENANT_ID, AZURE_AD_CLIENT_ID, AZURE_AD_CLIENT_SECRET, AZURE_FROM_EMAIL.
 */

const GRAPH_SCOPE = "https://graph.microsoft.com/.default";

export async function getAccessToken(): Promise<string> {
  const tenantId = process.env.AZURE_AD_TENANT_ID;
  const clientId = process.env.AZURE_AD_CLIENT_ID;
  const clientSecret = process.env.AZURE_AD_CLIENT_SECRET;
  if (!tenantId?.trim() || !clientId?.trim() || !clientSecret) {
    throw new Error("Missing AZURE_AD_TENANT_ID, AZURE_AD_CLIENT_ID, or AZURE_AD_CLIENT_SECRET");
  }
  const url = `https://login.microsoftonline.com/${tenantId.trim()}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    client_id: clientId.trim(),
    client_secret: clientSecret,
    grant_type: "client_credentials",
    scope: GRAPH_SCOPE,
  });
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Token request failed (${res.status}): ${text.slice(0, 500)}`);
  }
  const json = JSON.parse(text) as { access_token?: string };
  if (!json.access_token) {
    throw new Error("No access_token in token response");
  }
  return json.access_token;
}

export interface SendEmailViaGraphOptions {
  to: string;
  toName?: string | null;
  subject: string;
  textContent: string;
  htmlContent?: string | null;
}

/**
 * Sends a message from AZURE_FROM_EMAIL (or fromEmailOverride).
 */
export async function sendEmailViaGraph(
  options: SendEmailViaGraphOptions,
  fromEmailOverride?: string
): Promise<{ success: boolean; error?: string }> {
  const from = (fromEmailOverride ?? process.env.AZURE_FROM_EMAIL)?.trim();
  if (!from) {
    return { success: false, error: "AZURE_FROM_EMAIL is not set" };
  }
  const { to, toName, subject, textContent, htmlContent } = options;
  if (!to?.trim()) {
    return { success: false, error: "Recipient email is empty" };
  }

  let token: string;
  try {
    token = await getAccessToken();
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }

  const useHtml = Boolean(htmlContent?.trim());
  const message = {
    subject,
    body: useHtml
      ? { contentType: "HTML", content: htmlContent!.trim() }
      : { contentType: "Text", content: textContent },
    toRecipients: [
      {
        emailAddress: {
          address: to.trim(),
          ...(toName?.trim() ? { name: toName.trim() } : {}),
        },
      },
    ],
  };

  const graphUrl = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(from)}/sendMail`;
  const res = await fetch(graphUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message,
      saveToSentItems: true,
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    return {
      success: false,
      error: `Graph sendMail failed (${res.status}): ${errBody.slice(0, 800)}`,
    };
  }
  return { success: true };
}

/** Confirms client credentials work; does not send a message. */
export async function verifyEmailConnection(): Promise<{ ok: boolean; error?: string }> {
  try {
    await getAccessToken();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
