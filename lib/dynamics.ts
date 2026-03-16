import axios, { type AxiosInstance } from "axios";

/**
 * Dynamics 365 HRMIS integration via Dataverse Web API.
 * Fetches employees and reporting lines for the appraisal portal.
 *
 * Environment variables required when integrating:
 * - DYNAMICS_BASE_URL (e.g. https://org.crm.dynamics.com)
 * - DYNAMICS_CLIENT_ID (Azure app registration)
 * - DYNAMICS_CLIENT_SECRET
 * - DYNAMICS_TENANT_ID
 */

const DYNAMICS_BASE_URL = process.env.DYNAMICS_BASE_URL ?? "";
const API_VERSION = "v9.2";

export interface DynamicsEmployee {
  systemuserid?: string;
  fullname?: string;
  internalemailaddress?: string;
  title?: string;
  parentsystemuserid?: string;
  [key: string]: unknown;
}

export interface ReportingLine {
  employeeId: string;
  managerId: string | null;
  level: number;
}

/**
 * Create an authenticated Axios instance for Dataverse Web API.
 * Token acquisition (OAuth2 with client credentials or OBO) to be implemented.
 */
function createDynamicsClient(): AxiosInstance {
  return axios.create({
    baseURL: `${DYNAMICS_BASE_URL}/api/data/${API_VERSION}`,
    headers: {
      "OData-MaxVersion": "4.0",
      "OData-Version": "4.0",
      "Content-Type": "application/json",
      Accept: "application/json",
      // Authorization: "Bearer <token>" will be set when Entra ID integration is done
    },
  });
}

let dynamicsClient: AxiosInstance | null = null;

export function getDynamicsClient(): AxiosInstance {
  if (!dynamicsClient) {
    dynamicsClient = createDynamicsClient();
  }
  return dynamicsClient;
}

/**
 * Fetch employees from Dynamics 365 (placeholder).
 * Actual implementation will call Dataverse Web API (e.g. systemuser or custom entity).
 */
export async function getEmployees(): Promise<DynamicsEmployee[]> {
  // TODO: Call Dataverse Web API when credentials and entity mapping are configured
  // const client = getDynamicsClient();
  // const { data } = await client.get("/systemusers?$select=systemuserid,fullname,internalemailaddress,title,parentsystemuserid");
  return [];
}

/**
 * Fetch reporting lines / hierarchy from Dynamics (placeholder).
 */
export async function getReportingLines(): Promise<ReportingLine[]> {
  // TODO: Build from employee data or call dedicated hierarchy endpoint
  return [];
}

/**
 * Get current user's manager from Dynamics (placeholder).
 */
export async function getManagerForEmployee(employeeId: string): Promise<DynamicsEmployee | null> {
  // TODO: Resolve via parentsystemuserid or reporting entity
  return null;
}
