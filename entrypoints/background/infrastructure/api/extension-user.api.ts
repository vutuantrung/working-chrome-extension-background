import { AxiosInstance } from "axios";

export interface UpdateExtensionSessionPayload {
  schedule_start_time: string; // ISO or "HH:mm:ss" depending on backend
  schedule_end_time: string;
  automation?: boolean;
}

export const loginByApikey = async (http: AxiosInstance, apikey: string, extensionId: string) => {
  const response = await http.post(
    "/extension-sessions/signin",
    {
      api_key: apikey,
      extension_id: extensionId || "",
    });
  return response.data;
};

export const login = async (http: AxiosInstance, username: string, password: string, extension_id: string) => {
  const response = await http.post(
    "/extension-sessions/signin",
    {
      username,
      password,
      extension_id,
    });
  return response.data;
};

export const logout = async (http: AxiosInstance, extensionId: string) => {
  const response = await http.post(
    "/extension-sessions/signout",
    {
      extension_id: extensionId
    });
  return response.data;
};

export const updateExtensionSession = async (http: AxiosInstance, extensionId: string, payload: UpdateExtensionSessionPayload) => {
  const response = await http.patch(
    `/extension-sessions/${extensionId}`,
    payload,
  );
  return response.data;
};

export const getExtensionConfigInfo = async (http: AxiosInstance, extensionConfigId: string, filter?: any) => {
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

export const deactivatePersona = async (http: AxiosInstance, persona_id: string) => {
  const response = await http.patch(`/extension-sessions/inactive-persona/${persona_id}`);
  return response.data;
};

export const activatePersonaSession = async (http: AxiosInstance, persona_id: string) => {
  const response = await http.patch(`/extension-sessions/active-persona/${persona_id}`);
  return response.data;
};