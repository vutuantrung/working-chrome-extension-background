import { UpdateExtensionSessionPayload, CreatePersonasPayload } from "../../types/types";
import { http } from "./http";

export const loginApi = async (
  username: string,
  password: string,
  extension_id: string,
) => {
  const response = await http.post("/extension-sessions/signin", {
    username,
    password,
    extension_id,
  });
  return response.data;
};

// Login using an apikey instead of username/password.
// Sends the apikey to the same signin endpoint; the server returns
// the same session response so downstream logic is identical.
export const loginWithApikeyApi = async (
  apikey: string,
  extension_id: string,
) => {
  const response = await http.post("/extension-sessions/signin", {
    api_key: apikey,
    extension_id: extension_id || "",
  });
  return response.data;
};

export const logoutApi = async (extension_id: string) => {
  const response = await http.post("/extension-sessions/signout", {
    extension_id,
  });
  return response.data;
};

export const updateExtensionSession = async (
  extension_id: string,
  payload: UpdateExtensionSessionPayload,
) => {
  const response = await http.patch(
    `/extension-sessions/${extension_id}`,
    payload,
  );
  return response.data;
};

export const getSocialAccountInfo = async (id: string) => {
  const response = await http.get(`/social-account/${id}/proxy`);
  return response.data;
};

export const getPersonas = async (user_id: string, filter?: any) => {
  const response = await http.get("/personas", {
    params: {
      filter: JSON.stringify({
        offset: 0,
        limit: 500,
        where: {
          user_id,
        },
        ...(filter || {}),
      }),
    },
  });

  return response.data;
};

export const createPersona = async () => {
  const body: CreatePersonasPayload = {
    generate_conditions: {
      country: "VN",
      topic_ids: [],
    },
    account_and_device_resources: [],
    proxy_resources: [],
    email_resources: [],
    platforms: ["facebook"],
  };

  const response = await http.post("/personas/assign-to-user", body);
  return response.data;
};

export const getPersonaById = async (persona_id: string) => {
  const response = await http.get(`/personas/${persona_id}`);
  return response.data;
};

export const getProxiesByPersona = async (persona_id: string, filter?: any) => {
  const response = await http.get("/proxies", {
    params: {
      filter: JSON.stringify({
        offset: 0,
        limit: 100,
        where: {
          persona_id,
        },
        ...(filter || {}),
      }),
    },
  });

  return response.data;
};

export const inactivePersona = async (persona_id: string) => {
  const response = await http.patch(
    `/extension-sessions/inactive-persona/${persona_id}`,
  );

  return response.data;
};

export const activePersonaSession = async (persona_id: string) => {
  const response = await http.patch(
    `/extension-sessions/active-persona/${persona_id}`,
  );

  return response.data;
};

export const getSocialAccountsByPersona = async (
  persona_id: string,
  filter?: any,
) => {
  const response = await http.get("/social-account", {
    params: {
      filter: JSON.stringify({
        offset: 0,
        limit: 100,
        where: {
          persona_id,
        },
        ...(filter || {}),
      }),
    },
  });

  return response.data;
};

// background, sidepanel
export const getProxyInfo = async (proxy_id: string) => {
  const response = await http.get(`/proxies/${proxy_id}`);
  return response.data;
};
// background, sidepanel
export const getExtensionConfigInfo = async (
  extension_config_id: string,
  filter?: any,
) => {
  const response = await http.get(`/extension-configs/${extension_config_id}`, {
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