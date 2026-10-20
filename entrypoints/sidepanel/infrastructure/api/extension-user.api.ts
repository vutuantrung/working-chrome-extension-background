import { http } from "../../helpers/helpers-http";

export interface UpdateExtensionSessionPayload {
  schedule_start_time: string; // ISO or "HH:mm:ss" depending on backend
  schedule_end_time: string;
  automation?: boolean;
}

// Login using an apikey instead of username/password.
// Sends the apikey to the same signin endpoint; the server returns
// the same session response so downstream logic is identical.
export const loginWithApikeyApi = async (apikey: string, extensionId: string) => {
  const response = await http.post(
    "/extension-sessions/signin",
    {
      api_key: apikey,
      extension_id: extensionId || "",
    });
  return response.data;
};

export const logoutApi = async (extensionId: string) => {
  const response = await http.post(
    "/extension-sessions/signout",
    {
      extension_id: extensionId
    });
  return response.data;
};

export const updateExtensionSession = async (extensionId: string, payload: UpdateExtensionSessionPayload) => {
  const response = await http.patch(
    `/extension-sessions/${extensionId}`,
    payload,
  );
  return response.data;
};

export const getExtensionConfigInfo = async (extensionConfigId: string, filter?: any) => {
  const response = await http.get(
    `/extension-configs/${extensionConfigId}`,
    {
      params: {
        relation_proxy: true,
        relation_user: true,
        relation_social_accounts: true,
        ...(filter && { filter: JSON.stringify(filter) }),
        include_topics: true,
      },
    });
  return response.data;
};

export const loginApi = async (username: string, password: string, extension_id: string) => {
  const response = await http.post(
    "/extension-sessions/signin",
    {
      username,
      password,
      extension_id,
    });
  return response.data;
};

export const deactivatePersona = async (persona_id: string) => {
  const response = await http.patch(`/extension-sessions/inactive-persona/${persona_id}`);
  return response.data;
};

export const activatePersonaSession = async (persona_id: string) => {
  const response = await http.patch(`/extension-sessions/active-persona/${persona_id}`);
  return response.data;
};