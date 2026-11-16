import { AxiosInstance } from "axios";

export const getProxiesByPersona = async (
    http: AxiosInstance,
    personaId: string,
    filter?: any
) => {
    const response = await http.get(
        "/proxies", {
        params: {
            filter: JSON.stringify({
                offset: 0,
                limit: 100,
                where: { persona_id: personaId },
                ...(filter || {}),
            }),
        },
    });

    return response.data;
};

export const getProxyInfo = async (
    http: AxiosInstance,
    proxy_id: string
) => {
    const response = await http.get(`/proxies/${proxy_id}`);
    return response.data;
};