/**
 * Adobe Sign API client for appraisal e-signature flow.
 * Uses integration key (Bearer) auth; configure ADOBE_SIGN_INTEGRATION_KEY and ADOBE_SIGN_API_BASE.
 */

const BASE = process.env.ADOBE_SIGN_API_BASE ?? "https://api.na4.adobesign.com/api/rest/v6";
const KEY = process.env.ADOBE_SIGN_INTEGRATION_KEY ?? "";

const headers: Record<string, string> = {
  Authorization: `Bearer ${KEY}`,
  "Content-Type": "application/json",
};

/** Upload a PDF as a transient document; returns transientDocumentId. */
export async function uploadTransientDocument(
  pdfBuffer: Buffer,
  filename: string
): Promise<string> {
  const form = new FormData();
  form.append("File", new Blob([new Uint8Array(pdfBuffer)], { type: "application/pdf" }), filename);
  form.append("File-Name", filename);

  const res = await fetch(`${BASE}/transientDocuments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KEY}`,
    },
    body: form,
  });

  const data = (await res.json()) as { transientDocumentId?: string; [k: string]: unknown };
  if (!data.transientDocumentId) {
    throw new Error(`Adobe Sign upload failed: ${JSON.stringify(data)}`);
  }
  return data.transientDocumentId as string;
}

export interface CreateAgreementParams {
  transientDocumentId: string;
  agreementName: string;
  employee: { email: string; name: string };
  manager: { email: string; name: string };
  hrOfficer: { email: string; name: string };
  webhookUrl: string;
}

/** Create agreement with three signers in order: Employee → Manager → HR. */
export async function createAgreement(params: CreateAgreementParams): Promise<string> {
  const {
    transientDocumentId,
    agreementName,
    employee,
    manager,
    hrOfficer,
    webhookUrl,
  } = params;

  const body = {
    fileInfos: [{ transientDocumentId }],
    name: agreementName,
    participantSetsInfo: [
      {
        order: 1,
        role: "SIGNER",
        memberInfos: [{ email: employee.email, name: employee.name }],
      },
      {
        order: 2,
        role: "SIGNER",
        memberInfos: [{ email: manager.email, name: manager.name }],
      },
      {
        order: 3,
        role: "SIGNER",
        memberInfos: [{ email: hrOfficer.email, name: hrOfficer.name }],
      },
    ],
    signatureType: "ESIGN",
    state: "IN_PROCESS",
    expirationTime: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    reminderFrequency: "WEEKLY_UNTIL_SIGNED",
    emailOption: {
      sendOptions: {
        initEmails: "ALL",
        inFlightEmails: "ALL",
        completionEmails: "ALL",
      },
    },
  };

  const res = await fetch(`${BASE}/agreements`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  const data = (await res.json()) as { id?: string; [k: string]: unknown };
  if (!data.id) {
    throw new Error(`Adobe Sign agreement creation failed: ${JSON.stringify(data)}`);
  }
  return data.id as string;
}

/** Cancel an agreement. */
export async function cancelAgreement(agreementId: string, reason: string): Promise<void> {
  const res = await fetch(`${BASE}/agreements/${agreementId}/state`, {
    method: "PUT",
    headers,
    body: JSON.stringify({
      state: "CANCELLED",
      agreementCancellationInfo: { comment: reason },
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Adobe Sign cancel failed: ${res.status} ${text}`);
  }
}

/** Download the combined signed PDF. */
export async function downloadSignedPDF(agreementId: string): Promise<Buffer> {
  const res = await fetch(`${BASE}/agreements/${agreementId}/combinedDocument`, {
    headers: { Authorization: `Bearer ${KEY}` },
  });
  if (!res.ok) throw new Error(`Adobe Sign download failed: ${res.status}`);
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/** Get agreement details/status. */
export async function getAgreementStatus(agreementId: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${BASE}/agreements/${agreementId}`, { headers });
  if (!res.ok) throw new Error(`Adobe Sign get status failed: ${res.status}`);
  return (await res.json()) as Record<string, unknown>;
}

/** Send a reminder to the next signer(s). */
export async function sendReminder(agreementId: string): Promise<void> {
  const res = await fetch(`${BASE}/agreements/${agreementId}/reminders`, {
    method: "POST",
    headers,
    body: JSON.stringify({}),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Adobe Sign reminder failed: ${res.status} ${text}`);
  }
}
